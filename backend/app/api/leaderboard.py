from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Dict, Any
from app.database import get_db
from app.models.team import Team, TeamStatus
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
    """Get all evaluated rounds + frozen rounds with their current weights"""
    
    # Get all evaluated rounds
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    # Also include frozen rounds that are not yet evaluated (current round)
    frozen_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_frozen == True,
        UnifiedEvent.is_evaluated == False,
        UnifiedEvent.round_number > 0
    ).all()
    
    # Combine both sets
    all_rounds = evaluated_rounds + frozen_rounds
    
    rounds_with_weights = []
    
    for round_data in all_rounds:
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
            "weight_percentage": weight.weight_percentage,
            "is_frozen": round_data.is_frozen,
            "is_evaluated": round_data.is_evaluated
        })
    
    return {"evaluated_rounds": rounds_with_weights}

@router.get("/")
async def get_leaderboard(db: Session = Depends(get_db)):
    """Calculate weighted average scores and normalize to 100"""
    
    # Get all evaluated rounds
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    # Also include frozen rounds that are not yet evaluated (current round)
    frozen_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_frozen == True,
        UnifiedEvent.is_evaluated == False,
        UnifiedEvent.round_number > 0
    ).all()
    
    # Combine both sets
    all_rounds = evaluated_rounds + frozen_rounds
    
    if not all_rounds:
        return {"teams": [], "message": "No evaluated or frozen rounds found"}
    
    # Get all teams (including eliminated and completed)
    all_teams = db.query(Team).all()
    
    leaderboard = []
    
    # Create a set of all round IDs for faster lookup
    all_round_ids = {round_data.id for round_data in all_rounds}
    
    # Pre-fetch all weights to avoid repeated queries
    weights_cache = {}
    if all_round_ids:
        existing_weights = db.query(RoundWeight).filter(
            RoundWeight.round_id.in_(all_round_ids)
        ).all()
        
        for weight in existing_weights:
            weights_cache[weight.round_id] = weight.weight_percentage
        
        # Create missing weights in batch
        missing_round_ids = all_round_ids - set(weights_cache.keys())
        for round_id in missing_round_ids:
            weight = RoundWeight(
                round_id=round_id,
                weight_percentage=100.0
            )
            db.add(weight)
            weights_cache[round_id] = 100.0
        
        # Commit all new weights at once
        if missing_round_ids:
            db.commit()
    
    for team in all_teams:
        # Get scores for this team from all relevant rounds
        team_scores = db.query(TeamScore).filter(
            TeamScore.team_id == team.team_id,
            TeamScore.round_id.in_(all_round_ids)
        ).all()
        
        # Create a dictionary of scores for easier lookup
        team_scores_dict = {score.round_id: score.score for score in team_scores}
        
        # Calculate weighted average (including 0 scores for missing rounds)
        total_weighted_score = 0.0
        total_weight = 0.0
        rounds_completed = 0
        
        for round_id in all_round_ids:
            # Use cached weight
            weight_percentage = weights_cache.get(round_id, 100.0)
            
            # Get score for this round (0 if not found)
            round_score = team_scores_dict.get(round_id, 0.0)
            
            weight_value = weight_percentage / 100.0  # Convert to decimal
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

@router.post("/shortlist")
async def shortlist_teams_by_overall_score(
    shortlist_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Shortlist teams based on overall score (weighted average) across all evaluated and frozen rounds (PDA only)"""
    
    shortlist_type = shortlist_data.get("type")  # "top_k" or "threshold"
    value = shortlist_data.get("value")  # K for top_k, threshold score for threshold
    
    if not shortlist_type or value is None:
        raise HTTPException(status_code=400, detail="Missing shortlist type or value")
    
    if shortlist_type not in ["top_k", "threshold"]:
        raise HTTPException(status_code=400, detail="Invalid shortlist type. Must be 'top_k' or 'threshold'")
    
    # Get all active teams with their overall scores
    all_active_teams = db.query(Team).filter(Team.status == TeamStatus.ACTIVE).all()
    
    if not all_active_teams:
        raise HTTPException(status_code=400, detail="No active teams found for shortlisting")
    
    # Get all evaluated and frozen rounds for overall score calculation
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    frozen_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_frozen == True,
        UnifiedEvent.is_evaluated == False,
        UnifiedEvent.round_number > 0
    ).all()
    
    all_rounds = evaluated_rounds + frozen_rounds
    
    if not all_rounds:
        raise HTTPException(status_code=400, detail="No evaluated or frozen rounds found for shortlisting")
    
    # Pre-fetch all weights to avoid repeated queries
    weights_cache = {}
    all_round_ids = {round_obj.id for round_obj in all_rounds}
    
    if all_round_ids:
        existing_weights = db.query(RoundWeight).filter(
            RoundWeight.round_id.in_(all_round_ids)
        ).all()
        
        for weight in existing_weights:
            weights_cache[weight.round_id] = weight.weight_percentage
        
        # Create missing weights in batch
        missing_round_ids = all_round_ids - set(weights_cache.keys())
        for round_id in missing_round_ids:
            weight = RoundWeight(
                round_id=round_id,
                weight_percentage=100.0
            )
            db.add(weight)
            weights_cache[round_id] = 100.0
        
        # Commit all new weights at once
        if missing_round_ids:
            db.commit()
    
    # Calculate overall scores for all teams using cached weights
    all_teams_with_scores = []
    for team in all_active_teams:
        # Get scores for this team from all relevant rounds
        team_scores = db.query(TeamScore).filter(
            TeamScore.team_id == team.team_id,
            TeamScore.round_id.in_(all_round_ids)
        ).all()
        
        # Create a dictionary of scores for easier lookup
        team_scores_dict = {score.round_id: score.score for score in team_scores}
        
        # Calculate weighted average (including 0 scores for missing rounds)
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for round_id in all_round_ids:
            # Use cached weight
            weight_percentage = weights_cache.get(round_id, 100.0)
            
            # Get score for this round (0 if not found)
            round_score = team_scores_dict.get(round_id, 0.0)
            
            weight_value = weight_percentage / 100.0  # Convert to decimal
            total_weighted_score += round_score * weight_value
            total_weight += weight_value
        
        if total_weight > 0:
            # Calculate weighted average
            weighted_average = total_weighted_score / total_weight
            
            # Normalize to 100 (same logic as leaderboard)
            max_possible_score = max(team_scores_dict.values()) if team_scores_dict else 100.0
            if max_possible_score > 0:
                normalized_score = (weighted_average / max_possible_score) * 100
            else:
                normalized_score = 0.0
            
            all_teams_with_scores.append({
                'team_id': team.team_id,
                'team_name': team.team_name,
                'overall_score': normalized_score
            })
    
    # Sort by overall score (descending)
    all_teams_with_scores.sort(key=lambda x: x['overall_score'], reverse=True)
    
    if not all_teams_with_scores:
        raise HTTPException(status_code=400, detail="No teams with scores found for shortlisting")
    
    shortlisted_teams = []
    eliminated_teams = []
    
    if shortlist_type == "top_k":
        # Shortlist top K teams
        k = int(value)
        if k <= 0 or k > len(all_teams_with_scores):
            raise HTTPException(status_code=400, detail=f"Invalid top_k value: {k}. Must be between 1 and {len(all_teams_with_scores)}")
        shortlisted_teams = all_teams_with_scores[:k]
        eliminated_teams = all_teams_with_scores[k:]
        
    elif shortlist_type == "threshold":
        # Shortlist teams with overall score >= threshold
        threshold = float(value)
        if threshold < 0 or threshold > 100:
            raise HTTPException(status_code=400, detail=f"Invalid threshold value: {threshold}. Must be between 0 and 100")
        for team_data in all_teams_with_scores:
            if team_data['overall_score'] >= threshold:
                shortlisted_teams.append(team_data)
            else:
                eliminated_teams.append(team_data)
    
    # Update team statuses
    for team_data in shortlisted_teams:
        team = db.query(Team).filter(Team.team_id == team_data['team_id']).first()
        if team:
            team.status = TeamStatus.ACTIVE  # Keep as active (shortlisted)
            team.current_round += 1  # Increment current round for shortlisted teams
    
    for team_data in eliminated_teams:
        team = db.query(Team).filter(Team.team_id == team_data['team_id']).first()
        if team:
            team.status = TeamStatus.ELIMINATED  # Mark as eliminated
    
    # Set is_evaluated = 1 for ALL frozen rounds
    frozen_rounds_updated = 0
    for round_obj in frozen_rounds:
        round_obj.is_evaluated = True
        frozen_rounds_updated += 1
    
    db.commit()
    
    return {
        "shortlisted_count": len(shortlisted_teams),
        "eliminated_count": len(eliminated_teams),
        "shortlisted_teams": [team_data['team_id'] for team_data in shortlisted_teams],
        "frozen_rounds_count": frozen_rounds_updated,
        "shortlist_type": shortlist_type,
        "shortlist_value": value
    }
