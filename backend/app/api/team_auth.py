from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.team import Team, TeamMember, TeamStatus
from app.schemas.team import TeamInDB as TeamSchema
from pydantic import BaseModel

router = APIRouter(prefix="/api/team-auth", tags=["team-authentication"])

class TeamLoginRequest(BaseModel):
    team_id: str
    password: str

class TeamLoginResponse(BaseModel):
    success: bool
    team: TeamSchema
    message: str

@router.post("/login", response_model=TeamLoginResponse)
async def team_login(
    login_data: TeamLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate a team with team ID and password
    This endpoint is public but validates credentials
    """
    # Find team by team_id
    team = db.query(Team).filter(Team.team_id == login_data.team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=404,
            detail="No team found with this team ID"
        )
    
    # Check if team is active
    if team.status != TeamStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail=f"Team is {team.status.value.lower()}. Please contact organizers."
        )
    
    # Check password
    if team.password != login_data.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )
    
    # Get team members
    members = db.query(TeamMember).filter(TeamMember.team_id == team.team_id).all()
    
    # Create team response (without password)
    team_data = {
        "id": team.id,
        "team_id": team.team_id,
        "team_name": team.team_name,
        "leader_name": team.leader_name,
        "leader_register_number": team.leader_register_number,
        "leader_contact": team.leader_contact,
        "leader_email": team.leader_email,
        "current_round": team.current_round,
        "status": team.status,
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
    
    return TeamLoginResponse(
        success=True,
        team=team_data,
        message="Login successful"
    )

@router.get("/verify/{team_id}")
async def verify_team_exists(team_id: str, db: Session = Depends(get_db)):
    """
    Check if a team exists (without revealing password)
    """
    team = db.query(Team).filter(Team.team_id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )
    
    return {
        "exists": True,
        "team_id": team.team_id,
        "team_name": team.team_name,
        "status": team.status,
        "current_round": team.current_round
    }
