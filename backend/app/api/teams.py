from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.team import Team, TeamMember, TeamStatus
from app.models.team_score import TeamScore
from app.models.rounds import UnifiedEvent
from app.models.round_weight import RoundWeight
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
