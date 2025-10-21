from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.team_score import TeamScore
from app.schemas.team_score import TeamScoreInDB, TeamScoreUpdate
from app.auth import get_current_user, require_club_or_pda

router = APIRouter(prefix="/api/team-scores", tags=["team-scores"])

@router.get("/{team_id}", response_model=List[TeamScoreInDB])
async def get_team_scores(
    team_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Get all scores for a team across rounds"""
    team_scores = db.query(TeamScore).filter(TeamScore.team_id == team_id).all()
    return team_scores

@router.put("/{round_id}/{team_id}")
async def update_team_score(
    round_id: int,
    team_id: str,
    score_update: TeamScoreUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Update team score with criteria breakdown"""
    team_score = db.query(TeamScore).filter(
        TeamScore.round_id == round_id,
        TeamScore.team_id == team_id
    ).first()
    
    if not team_score:
        raise HTTPException(status_code=404, detail="Team score not found")
    
    # Update only provided fields
    update_data = score_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team_score, field, value)
    
    db.commit()
    db.refresh(team_score)
    return team_score
