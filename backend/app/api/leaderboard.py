from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Dict, Any
from app.database import get_db
from app.models.team import Team
from app.models.team_score import TeamScore
from app.models.round_weight import RoundWeight
from app.models.rounds import UnifiedEvent
from app.schemas.round_weight import RoundWeightUpdate
from app.auth import get_current_user, require_pda_role
import csv
import io

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

@router.get("/evaluated-rounds")
async def get_evaluated_rounds(db: Session = Depends(get_db)):
    """Get all evaluated rounds with their current weights"""
    
    # Get all evaluated rounds
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    rounds_with_weights = []
    
    for round_data in evaluated_rounds:
        # Get weight for this round, create default if not exists
        weight = db.query(RoundWeight).filter(
            RoundWeight.round_id == round_data.id
        ).first()
        
        if not weight:
            # Create default weight of 100%
            weight = RoundWeight(
                round_id=round_data.id,
                weight_percentage=100.0
            )
            db.add(weight)
            db.commit()
            db.refresh(weight)
        
        rounds_with_weights.append({
            "round_id": round_data.id,
            "round_name": round_data.name,
            "event_id": round_data.event_id,
            "weight_percentage": weight.weight_percentage
        })
    
    return {"evaluated_rounds": rounds_with_weights}

@router.get("/")
async def get_leaderboard(db: Session = Depends(get_db)):
    """Calculate weighted average scores and normalize to 100"""
    
    # Get all evaluated rounds with their weights
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    if not evaluated_rounds:
        return {"teams": [], "message": "No evaluated rounds found"}
    
    # Get all teams (including eliminated and completed)
    all_teams = db.query(Team).all()
    
    leaderboard = []
    
    # Create a set of evaluated round IDs for faster lookup
    evaluated_round_ids = {round_data.id for round_data in evaluated_rounds}
    
    for team in all_teams:
        # Get scores for this team ONLY from evaluated rounds
        team_scores = db.query(TeamScore).filter(
            TeamScore.team_id == team.team_id,
            TeamScore.round_id.in_(evaluated_round_ids)
        ).all()
        
        # Create a dictionary of scores for easier lookup
        team_scores_dict = {score.round_id: score.score for score in team_scores}
        
        # Calculate weighted average (including 0 scores for missing rounds)
        total_weighted_score = 0.0
        total_weight = 0.0
        rounds_completed = 0
        
        for round_id in evaluated_round_ids:
            # Get weight for this round, create default if not exists
            weight = db.query(RoundWeight).filter(
                RoundWeight.round_id == round_id
            ).first()
            
            if not weight:
                # Create default weight of 100%
                weight = RoundWeight(
                    round_id=round_id,
                    weight_percentage=100.0
                )
                db.add(weight)
                db.commit()
                db.refresh(weight)
            
            # Get score for this round (0 if not found)
            round_score = team_scores_dict.get(round_id, 0.0)
            
            weight_value = weight.weight_percentage / 100.0  # Convert to decimal
            total_weighted_score += round_score * weight_value
            total_weight += weight_value
            rounds_completed += 1
        
        if total_weight > 0:
            # Calculate weighted average
            weighted_average = total_weighted_score / total_weight
            
            # Normalize to 100: scale the weighted average to 100
            # Find the maximum possible weighted average across all teams for normalization
            final_score = weighted_average  # For now, keep as is since scores should already be normalized
            
            leaderboard.append({
                "team_id": team.team_id,
                "team_name": team.team_name,
                "leader_name": team.leader_name,
                "final_score": round(final_score, 2),
                "weighted_average": round(weighted_average, 2),
                "rounds_completed": rounds_completed,
                "current_round": team.current_round,
                "status": team.status
            })
    
    # Normalize all scores to 100
    if leaderboard:
        # Find the maximum weighted average
        max_score = max(team["weighted_average"] for team in leaderboard)
        
        # Normalize all scores to 100
        for team in leaderboard:
            if max_score > 0:
                normalized_score = (team["weighted_average"] / max_score) * 100
                team["final_score"] = round(normalized_score, 2)
            else:
                team["final_score"] = 0.0
    
    # Sort by final score (descending)
    leaderboard.sort(key=lambda x: x["final_score"], reverse=True)
    
    # Add rank
    for i, team in enumerate(leaderboard):
        team["rank"] = i + 1
    
    return {"teams": leaderboard}

@router.put("/weights/{round_id}")
async def update_round_weight(
    round_id: int,
    weight_update: RoundWeightUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Update weight for a round (PDA only) - uses upsert logic"""
    
    # Check if round exists
    round_data = db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
    if not round_data:
        raise HTTPException(status_code=404, detail="Round not found")
    
    # Get existing weight or create new one
    round_weight = db.query(RoundWeight).filter(RoundWeight.round_id == round_id).first()
    
    if round_weight:
        # Update existing weight
        round_weight.weight_percentage = weight_update.weight_percentage
    else:
        # Create new weight record
        round_weight = RoundWeight(
            round_id=round_id,
            weight_percentage=weight_update.weight_percentage
        )
        db.add(round_weight)
    
    db.commit()
    db.refresh(round_weight)
    
    return round_weight

@router.get("/export")
async def export_leaderboard(db: Session = Depends(get_db)):
    """Export leaderboard data as CSV"""
    
    # Get leaderboard data
    leaderboard_data = await get_leaderboard(db)
    teams = leaderboard_data.get("teams", [])
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Rank", "Team ID", "Team Name", "Leader Name", 
        "Final Score", "Weighted Average", "Rounds Completed", 
        "Current Round", "Status"
    ])
    
    # Write data
    for team in teams:
        writer.writerow([
            team["rank"],
            team["team_id"],
            team["team_name"],
            team["leader_name"],
            team["final_score"],
            team["weighted_average"],
            team["rounds_completed"],
            team["current_round"],
            team["status"]
        ])
    
    # Get CSV content
    csv_content = output.getvalue()
    output.close()
    
    # Return CSV file
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leaderboard.csv"}
    )
