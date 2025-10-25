from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.team import Team, TeamMember, TeamStatus
from app.models.team_score import TeamScore
from app.models.rounds import UnifiedEvent, EventType, EventStatus, EventMode
from app.models.round_weight import RoundWeight
from app.schemas.team import TeamInDB as TeamSchema, TeamStats, TeamMemberInDB
from app.schemas.team_score import TeamScoreInDB

router = APIRouter(prefix="/api/public", tags=["public-teams"])

def calculate_overall_score(team_id: str, db: Session, weights_cache: dict = None) -> Optional[float]:
    """Calculate overall score (weighted average) for a team based on evaluated rounds + current frozen round"""
    # Get all evaluated rounds + current frozen round (if not yet evaluated)
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    # Also include any frozen rounds that are not yet evaluated (current round)
    frozen_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_frozen == True,
        UnifiedEvent.is_evaluated == False,
        UnifiedEvent.round_number > 0
    ).all()
    
    # Combine both sets
    all_rounds = evaluated_rounds + frozen_rounds
    
    if not all_rounds:
        return None
    
    # Create a set of round IDs for faster lookup
    round_ids = {round_obj.id for round_obj in all_rounds}
    
    # Get team scores for all relevant rounds
    team_scores = db.query(TeamScore).filter(
        TeamScore.team_id == team_id,
        TeamScore.round_id.in_(round_ids)
    ).all()
    
    # Create a dictionary of scores for easier lookup
    team_scores_dict = {score.round_id: score.score for score in team_scores}
    
    # Calculate weighted average (including 0 scores for missing rounds)
    total_weighted_score = 0.0
    total_weight = 0.0
    
    for round_id in round_ids:
        # Use cached weight if available, otherwise query database
        if weights_cache and round_id in weights_cache:
            weight_percentage = weights_cache[round_id]
        else:
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
                # Don't commit here - let caller handle batch commit
                weight_percentage = 100.0
            else:
                weight_percentage = weight.weight_percentage
            
            # Cache the weight for future use
            if weights_cache is not None:
                weights_cache[round_id] = weight_percentage
        
        # Get score for this round (0 if not found)
        round_score = team_scores_dict.get(round_id, 0.0)
        
        weight_value = weight_percentage / 100.0  # Convert to decimal
        total_weighted_score += round_score * weight_value
        total_weight += weight_value
    
    if total_weight == 0:
        return None
    
    return total_weighted_score / total_weight

@router.get("/teams")
async def get_public_teams(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    status: Optional[TeamStatus] = Query(None, description="Filter by team status (ACTIVE, ELIMINATED, COMPLETED)"),
    db: Session = Depends(get_db)
):
    """
    Get all teams - PUBLIC ACCESS (No authentication required)
    
    Returns a list of teams with their basic information, members, and overall scores.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Parameters:
    - skip: Number of records to skip (for pagination)
    - limit: Maximum number of records to return (1-1000)
    - status: Optional filter by team status
    
    Returns:
    - List of teams with complete information including members and scores
    """
    print("DEBUG: get_public_teams function called")
    
    # First get teams
    query = db.query(Team)
    if status:
        query = query.filter(Team.status == status)
    
    teams = query.offset(skip).limit(limit).all()
    
    # Pre-fetch all weights to avoid repeated queries
    weights_cache = {}
    all_round_ids = set()
    
    # Get all relevant round IDs first
    evaluated_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_evaluated == True,
        UnifiedEvent.round_number > 0
    ).all()
    
    frozen_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.is_frozen == True,
        UnifiedEvent.is_evaluated == False,
        UnifiedEvent.round_number > 0
    ).all()
    
    for round_obj in evaluated_rounds + frozen_rounds:
        all_round_ids.add(round_obj.id)
    
    # Pre-fetch all existing weights
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
    
    # Then get members for each team separately and create proper response
    result = []
    for team in teams:
        # Get members for this team
        members = db.query(TeamMember).filter(TeamMember.team_id == team.team_id).all()
        
        # Calculate overall score using cached weights
        overall_score = calculate_overall_score(team.team_id, db, weights_cache)
        
        # Create team dictionary
        team_dict = {
            "id": team.id,
            "team_id": team.team_id,
            "team_name": team.team_name,
            "leader_name": team.leader_name,
            "leader_register_number": team.leader_register_number,
            "leader_contact": team.leader_contact,
            "leader_email": team.leader_email,
            "current_round": team.current_round,
            "status": team.status,
            "overall_score": overall_score,
            "created_at": team.created_at,
            "updated_at": team.updated_at,
            "members": [
                {
                    "id": member.id,
                    "team_id": member.team_id,
                    "member_name": member.member_name,
                    "register_number": member.register_number,
                    "member_position": member.member_position,
                    "created_at": member.created_at
                }
                for member in members
            ]
        }
        
        result.append(team_dict)
    
    return {
        "teams": result,
        "total_count": len(result),
        "skip": skip,
        "limit": limit,
        "status_filter": status
    }

@router.get("/teams/stats")
async def get_public_team_stats(db: Session = Depends(get_db)):
    """
    Get team statistics - PUBLIC ACCESS (No authentication required)
    
    Returns comprehensive statistics about teams including counts by status and round.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Returns:
    - Total teams count
    - Teams count by status (active, eliminated, completed)
    - Teams distribution by current round
    """
    total_teams = db.query(Team).count()
    active_teams = db.query(Team).filter(Team.status == TeamStatus.ACTIVE).count()
    eliminated_teams = db.query(Team).filter(Team.status == TeamStatus.ELIMINATED).count()
    completed_teams = db.query(Team).filter(Team.status == TeamStatus.COMPLETED).count()
    
    # Teams by round
    teams_by_round = {}
    for round_num in range(1, 10):  # Assuming max 9 rounds
        count = db.query(Team).filter(Team.current_round == round_num).count()
        if count > 0:
            teams_by_round[f"round_{round_num}"] = count
    
    return {
        "total_teams": total_teams,
        "active_teams": active_teams,
        "eliminated_teams": eliminated_teams,
        "completed_teams": completed_teams,
        "teams_by_round": teams_by_round,
        "status_distribution": {
            "active_percentage": round((active_teams / total_teams * 100), 2) if total_teams > 0 else 0,
            "eliminated_percentage": round((eliminated_teams / total_teams * 100), 2) if total_teams > 0 else 0,
            "completed_percentage": round((completed_teams / total_teams * 100), 2) if total_teams > 0 else 0
        }
    }

@router.get("/teams/{team_id}")
async def get_public_team(team_id: str, db: Session = Depends(get_db)):
    """
    Get a specific team by team_id - PUBLIC ACCESS (No authentication required)
    
    Returns detailed information about a specific team including all members and scores.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Parameters:
    - team_id: The unique team identifier (e.g., CRES-96DA2)
    
    Returns:
    - Complete team information including members and overall score
    """
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get members for this team
    members = db.query(TeamMember).filter(TeamMember.team_id == team.team_id).all()
    
    # Calculate overall score
    overall_score = calculate_overall_score(team.team_id, db)
    
    # Create team dictionary
    team_dict = {
        "id": team.id,
        "team_id": team.team_id,
        "team_name": team.team_name,
        "leader_name": team.leader_name,
        "leader_register_number": team.leader_register_number,
        "leader_contact": team.leader_contact,
        "leader_email": team.leader_email,
        "current_round": team.current_round,
        "status": team.status,
        "overall_score": overall_score,
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        "members": [
            {
                "id": member.id,
                "team_id": member.team_id,
                "member_name": member.member_name,
                "register_number": member.register_number,
                "member_position": member.member_position,
                "created_at": member.created_at
            }
            for member in members
        ]
    }
    
    return team_dict

@router.get("/teams/{team_id}/scores")
async def get_public_team_scores(
    team_id: str,
    db: Session = Depends(get_db)
):
    """
    Get team scores across all rounds - PUBLIC ACCESS (No authentication required)
    
    Returns all scores for a specific team across all rounds.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Parameters:
    - team_id: The unique team identifier (e.g., CRES-96DA2)
    
    Returns:
    - List of team scores with round information
    """
    # Check if team exists
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get team scores
    team_scores = db.query(TeamScore).filter(TeamScore.team_id == team_id).all()
    
    # Get round information for each score
    result = []
    for score in team_scores:
        round_info = db.query(UnifiedEvent).filter(UnifiedEvent.id == score.round_id).first()
        
        score_dict = {
            "id": score.id,
            "team_id": score.team_id,
            "round_id": score.round_id,
            "event_id": score.event_id,
            "score": score.score,
            "criteria_scores": score.criteria_scores,
            "raw_total_score": score.raw_total_score,
            "is_normalized": score.is_normalized,
            "created_at": score.created_at,
            "updated_at": score.updated_at,
            "round_info": {
                "round_number": round_info.round_number if round_info else None,
                "round_name": round_info.name if round_info else None,
                "round_type": round_info.type if round_info else None,
                "club": round_info.club if round_info else None,
                "date": round_info.date if round_info else None
            } if round_info else None
        }
        result.append(score_dict)
    
    return {
        "team_id": team_id,
        "team_name": team.team_name,
        "scores": result,
        "total_scores": len(result)
    }

@router.get("/leaderboard")
async def get_public_leaderboard(
    limit: int = Query(50, ge=1, le=100, description="Number of top teams to return"),
    db: Session = Depends(get_db)
):
    """
    Get public leaderboard - PUBLIC ACCESS (No authentication required)
    
    Returns a leaderboard of teams ranked by their weighted scores (sum of weighted scores) across all evaluated and frozen rounds.
    Uses the same calculation logic as the main leaderboard for consistency.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Parameters:
    - limit: Number of top teams to return (1-100)
    
    Returns:
    - Ranked list of teams with their weighted scores and normalized scores
    """
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
        return {
            "leaderboard": [],
            "total_teams": 0,
            "displayed_teams": 0,
            "message": "No evaluated or frozen rounds found"
        }
    
    # Get all teams (including eliminated and completed)
    all_teams = db.query(Team).all()
    
    leaderboard = []
    
    # Create a set of all round IDs for faster lookup
    all_round_ids = {round_data.id for round_data in all_rounds}
    
    # Pre-fetch all weights to avoid repeated queries
    weights_cache = {}
    if all_round_ids:
        weights = db.query(RoundWeight).filter(RoundWeight.round_id.in_(all_round_ids)).all()
        for weight in weights:
            weights_cache[weight.round_id] = weight.weight_percentage
    
    for team in all_teams:
        # Get all team scores for this team across all rounds
        team_scores = db.query(TeamScore).filter(
            TeamScore.team_id == team.team_id,
            TeamScore.round_id.in_(all_round_ids)
        ).all()
        
        # Create a dictionary for faster lookup
        team_scores_dict = {score.round_id: score.score for score in team_scores}
        
        # Calculate weighted score (sum of weighted scores) and weighted average
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
            # Calculate weighted average for reference
            weighted_average = total_weighted_score / total_weight
            
            # Use weighted score (sum) as the primary metric
            final_score = total_weighted_score
            
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
    
    # Add normalized score for reference (optional)
    if leaderboard:
        # Find the maximum final score (weighted score)
        max_score = max(team["final_score"] for team in leaderboard)
        
        # Add normalized score for reference
        for team in leaderboard:
            if max_score > 0:
                normalized_score = (team["final_score"] / max_score) * 100
                team["normalized_score"] = round(normalized_score, 2)
                team["percentile"] = round(normalized_score, 1)  # Keep for compatibility
            else:
                team["normalized_score"] = 0.0
                team["percentile"] = 0.0
    
    # Sort by final score (weighted score) descending
    leaderboard.sort(key=lambda x: x["final_score"], reverse=True)
    
    # Add rank
    for i, team in enumerate(leaderboard):
        team["rank"] = i + 1
    
    return {
        "leaderboard": leaderboard[:limit],
        "total_teams": len(leaderboard),
        "displayed_teams": min(limit, len(leaderboard))
    }

@router.get("/events")
async def get_public_events(
    skip: int = Query(0, ge=0, description="Number of events to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of events to return"),
    event_type: Optional[EventType] = Query(None, description="Filter by event type (title, rolling)"),
    status: Optional[EventStatus] = Query(None, description="Filter by event status (upcoming, in_progress, completed)"),
    db: Session = Depends(get_db)
):
    """
    Get all events with rounds - PUBLIC ACCESS (No authentication required)
    
    This endpoint is publicly accessible and doesn't require authentication.
    Returns all events with their associated rounds and details.
    """
    try:
        # Get only main events (round_number = 0)
        query = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0)
        
        if event_type:
            query = query.filter(UnifiedEvent.type == event_type)
        
        if status:
            query = query.filter(UnifiedEvent.status == status)
        
        main_events = query.offset(skip).limit(limit).all()
        
        # Build response with rounds
        result = []
        for event in main_events:
            # Get all rounds for this event
            rounds = db.query(UnifiedEvent).filter(
                UnifiedEvent.event_id == event.event_id,
                UnifiedEvent.round_number > 0
            ).order_by(UnifiedEvent.round_number).all()
            
            # Convert rounds to public format
            rounds_data = []
            for round_data in rounds:
                rounds_data.append({
                    "id": round_data.id,
                    "event_id": round_data.event_id,
                    "round_number": round_data.round_number,
                    "name": round_data.name,
                    "club": round_data.club,
                    "mode": round_data.mode.value if round_data.mode else None,
                    "date": round_data.date.isoformat() if round_data.date else None,
                    "description": round_data.description,
                    "extended_description": round_data.extended_description,
                    "form_link": round_data.form_link,
                    "contact": round_data.contact,
                    "status": round_data.status.value,
                    "venue": round_data.venue,
                    "is_frozen": round_data.is_frozen,
                    "is_evaluated": round_data.is_evaluated,
                    "criteria": round_data.criteria,
                    "created_at": round_data.created_at.isoformat(),
                    "updated_at": round_data.updated_at.isoformat() if round_data.updated_at else None
                })
            
            # Convert main event to public format
            event_data = {
                "id": event.id,
                "event_id": event.event_id,
                "event_code": event.event_code,
                "name": event.name,
                "type": event.type.value,
                "club": event.club,
                "start_date": event.start_date.isoformat() if event.start_date else None,
                "end_date": event.end_date.isoformat() if event.end_date else None,
                "venue": event.venue,
                "description": event.description,
                "extended_description": event.extended_description,
                "form_link": event.form_link,
                "contact": event.contact,
                "status": event.status.value,
                "created_at": event.created_at.isoformat(),
                "updated_at": event.updated_at.isoformat() if event.updated_at else None,
                "rounds": rounds_data
            }
            
            result.append(event_data)
        
        return {
            "events": result,
            "total": len(result),
            "skip": skip,
            "limit": limit,
            "message": "Events retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving events: {str(e)}")

@router.get("/rounds")
async def get_public_rounds(
    skip: int = Query(0, ge=0, description="Number of rounds to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of rounds to return"),
    db: Session = Depends(get_db)
):
    """
    Get all rounds - PUBLIC ACCESS (No authentication required)
    
    Returns all rounds from title events with their detailed information.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Parameters:
    - skip: Number of records to skip (for pagination)
    - limit: Maximum number of records to return (1-1000)
    
    Returns:
    - List of rounds with complete information including extended descriptions, form links, and contact details
    """
    try:
        # Get all rounds from title events (round_number > 0, type = TITLE)
        rounds = db.query(UnifiedEvent).filter(
            UnifiedEvent.round_number > 0,
            UnifiedEvent.type == EventType.TITLE
        ).order_by(UnifiedEvent.round_number).offset(skip).limit(limit).all()
        
        result = []
        for round_data in rounds:
            round_dict = {
                "id": round_data.id,
                "event_id": round_data.event_id,
                "round_number": round_data.round_number,
                "name": round_data.name,
                "club": round_data.club,
                "type": round_data.mode.value if round_data.mode else "Offline",
                "date": round_data.date.isoformat() if round_data.date else None,
                "description": round_data.description,
                "extended_description": round_data.extended_description,
                "form_link": round_data.form_link,
                "contact": round_data.contact,
                "status": round_data.status.value,
                "venue": round_data.venue,
                "is_frozen": round_data.is_frozen,
                "is_evaluated": round_data.is_evaluated,
                "criteria": round_data.criteria,
                "max_score": round_data.max_score,
                "min_score": round_data.min_score,
                "avg_score": round_data.avg_score,
                "created_at": round_data.created_at.isoformat(),
                "updated_at": round_data.updated_at.isoformat() if round_data.updated_at else None
            }
            result.append(round_dict)
        
        return {
            "rounds": result,
            "total": len(result),
            "skip": skip,
            "limit": limit,
            "message": "Rounds retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving rounds: {str(e)}")

@router.get("/rolling-events")
async def get_public_rolling_events(
    skip: int = Query(0, ge=0, description="Number of rolling events to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of rolling events to return"),
    db: Session = Depends(get_db)
):
    """
    Get all rolling events - PUBLIC ACCESS (No authentication required)
    
    Returns all rolling events with their detailed information.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Parameters:
    - skip: Number of records to skip (for pagination)
    - limit: Maximum number of records to return (1-1000)
    
    Returns:
    - List of rolling events with complete information including extended descriptions, form links, and contact details
    """
    try:
        # Get all rolling events (type = ROLLING, round_number = 0)
        rolling_events = db.query(UnifiedEvent).filter(
            UnifiedEvent.type == EventType.ROLLING,
            UnifiedEvent.round_number == 0
        ).offset(skip).limit(limit).all()
        
        result = []
        for event in rolling_events:
            event_dict = {
                "id": event.id,
                "event_id": event.event_id,
                "event_code": event.event_code,
                "name": event.name,
                "club": event.club,
                "type": event.mode.value if event.mode else "Offline",
                "date": event.start_date.isoformat() if event.start_date else None,
                "description": event.description,
                "extended_description": event.extended_description,
                "form_link": event.form_link,
                "contact": event.contact,
                "status": event.status.value,
                "venue": event.venue,
                "start_date": event.start_date.isoformat() if event.start_date else None,
                "end_date": event.end_date.isoformat() if event.end_date else None,
                "created_at": event.created_at.isoformat(),
                "updated_at": event.updated_at.isoformat() if event.updated_at else None
            }
            result.append(event_dict)
        
        return {
            "rolling_events": result,
            "total": len(result),
            "skip": skip,
            "limit": limit,
            "message": "Rolling events retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving rolling events: {str(e)}")

@router.get("/health")
async def public_health_check():
    """
    Public health check endpoint - PUBLIC ACCESS (No authentication required)
    
    Returns the status of the public API endpoints.
    This endpoint is publicly accessible and doesn't require authentication.
    
    Returns:
    - API status and available endpoints
    """
    return {
        "status": "healthy",
        "service": "Crestora'25 Public Teams API",
        "version": "1.0.0",
        "available_endpoints": [
            "GET /api/public/teams - Get all teams",
            "GET /api/public/teams/stats - Get team statistics",
            "GET /api/public/teams/{team_id} - Get specific team",
            "GET /api/public/teams/{team_id}/scores - Get team scores",
            "GET /api/public/leaderboard - Get leaderboard",
            "GET /api/public/events - Get all events with rounds",
            "GET /api/public/rounds - Get all rounds",
            "GET /api/public/rolling-events - Get all rolling events",
            "GET /api/public/health - Health check"
        ],
        "authentication_required": False
    }
