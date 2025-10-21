from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.team import Team, TeamMember, TeamStatus

router = APIRouter(prefix="/api/teams", tags=["teams"])

@router.get("/")
async def get_teams_simple(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get all teams with optional filtering - simplified version"""
    query = db.query(Team)
    
    if status:
        query = query.filter(Team.status == status)
    
    teams = query.offset(skip).limit(limit).all()
    
    # Simple serialization with members
    result = []
    for team in teams:
        # Get members for this team
        members = db.query(TeamMember).filter(TeamMember.team_id == team.team_id).all()
        
        result.append({
            "id": team.id,
            "team_id": team.team_id,
            "team_name": team.team_name,
            "leader_name": team.leader_name,
            "leader_register_number": team.leader_register_number,
            "leader_contact": team.leader_contact,
            "leader_email": team.leader_email,
            "current_round": team.current_round,
            "status": team.status.value if team.status else None,
            "created_at": team.created_at.isoformat() if team.created_at else None,
            "updated_at": team.updated_at.isoformat() if team.updated_at else None,
            "members": [
                {
                    "id": member.id,
                    "team_id": member.team_id,
                    "member_name": member.member_name,
                    "register_number": member.register_number,
                    "member_position": member.member_position,
                    "created_at": member.created_at.isoformat() if member.created_at else None
                }
                for member in members
            ]
        })
    
    return result

@router.get("/stats")
async def get_team_stats_simple(db: Session = Depends(get_db)):
    """Get team statistics - simplified version"""
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
        "teams_by_round": teams_by_round
    }
