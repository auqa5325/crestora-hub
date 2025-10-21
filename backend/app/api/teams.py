from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.team import Team, TeamMember, TeamStatus
from app.models.team_score import TeamScore
from app.schemas.team import TeamInDB as TeamSchema, TeamCreate, TeamUpdate, TeamStats, TeamMemberInDB
from app.schemas.team_score import TeamScoreInDB
from app.auth import get_current_user, require_pda_role
from passlib.context import CryptContext

router = APIRouter(prefix="/api/teams", tags=["teams"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password"""
    return pwd_context.verify(plain_password, hashed_password)

@router.get("/")
async def get_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[TeamStatus] = None,
    db: Session = Depends(get_db)
):
    """Get all teams with optional filtering"""
    print("DEBUG: get_teams function called")
    from sqlalchemy.orm import joinedload
    
    # First get teams
    query = db.query(Team)
    if status:
        query = query.filter(Team.status == status)
    
    teams = query.offset(skip).limit(limit).all()
    
    # Then get members for each team separately and create proper Pydantic models
    result = []
    for team in teams:
        # Get members for this team
        members = db.query(TeamMember).filter(TeamMember.team_id == team.team_id).all()
        
        # Create TeamMemberInDB objects
        member_objects = [
            TeamMemberInDB(
                id=member.id,
                team_id=member.team_id,
                member_name=member.member_name,
                register_number=member.register_number,
                member_position=member.member_position,
                created_at=member.created_at
            )
            for member in members
        ]
        
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
    
    return result

@router.get("/stats", response_model=TeamStats)
async def get_team_stats(db: Session = Depends(get_db)):
    """Get team statistics"""
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
    
    return TeamStats(
        total_teams=total_teams,
        active_teams=active_teams,
        eliminated_teams=eliminated_teams,
        completed_teams=completed_teams,
        teams_by_round=teams_by_round
    )

@router.get("/{team_id}", response_model=TeamSchema)
async def get_team(team_id: str, db: Session = Depends(get_db)):
    """Get a specific team by team_id"""
    from sqlalchemy.orm import joinedload
    
    team = db.query(Team).options(joinedload(Team.members)).filter(Team.team_id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Convert to dict with members
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
            for member in team.members
        ]
    }
    
    return team_dict

@router.post("/", response_model=TeamSchema)
async def create_team(team_data: TeamCreate, db: Session = Depends(get_db)):
    """Create a new team"""
    # Check if team_id already exists
    existing_team = db.query(Team).filter(Team.team_id == team_data.team_id).first()
    if existing_team:
        raise HTTPException(status_code=400, detail="Team ID already exists")
    
    # Hash password
    hashed_password = hash_password(team_data.password)
    
    # Create team
    db_team = Team(
        team_id=team_data.team_id,
        team_name=team_data.team_name,
        leader_name=team_data.leader_name,
        leader_register_number=team_data.leader_register_number,
        leader_contact=team_data.leader_contact,
        leader_email=team_data.leader_email,
        password=hashed_password,
        current_round=team_data.current_round,
        status=team_data.status
    )
    
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    
    # Add team members
    for member_data in team_data.members:
        db_member = TeamMember(
            team_id=db_team.team_id,
            member_name=member_data.member_name,
            register_number=member_data.register_number,
            member_position=member_data.member_position
        )
        db.add(db_member)
    
    db.commit()
    db.refresh(db_team)
    
    return db_team

@router.put("/{team_id}", response_model=TeamSchema)
async def update_team(
    team_id: str, 
    team_update: TeamUpdate, 
    db: Session = Depends(get_db)
):
    """Update a team"""
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Update only provided fields
    update_data = team_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
    
    db.commit()
    db.refresh(team)
    
    return team

@router.delete("/{team_id}")
async def delete_team(team_id: str, db: Session = Depends(get_db)):
    """Delete a team"""
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    db.delete(team)
    db.commit()
    
    return {"message": "Team deleted successfully"}

@router.put("/{team_id}/status")
async def update_team_status(
    team_id: str,
    status: TeamStatus,
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Update team status (PDA only)"""
    
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team.status = status
    db.commit()
    db.refresh(team)
    
    return {"message": f"Team status updated to {status}", "team": team}

@router.get("/{team_id}/scores", response_model=List[TeamScoreInDB])
async def get_team_scores(
    team_id: str,
    db: Session = Depends(get_db)
):
    """Get team scores across all rounds"""
    team_scores = db.query(TeamScore).filter(TeamScore.team_id == team_id).all()
    return team_scores
