from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class TeamScoreBase(BaseModel):
    team_id: str = Field(..., max_length=20)
    round_id: int
    event_id: str = Field(..., max_length=20)
    score: float = Field(..., ge=0, le=100)  # Normalized to 100
    criteria_scores: Optional[Dict[str, float]] = None
    raw_total_score: float = Field(..., ge=0)
    is_normalized: bool = False
    is_present: bool = True

class TeamScoreCreate(TeamScoreBase):
    pass

class TeamScoreUpdate(BaseModel):
    score: Optional[float] = Field(None, ge=0, le=100)
    criteria_scores: Optional[Dict[str, float]] = None
    raw_total_score: Optional[float] = Field(None, ge=0)
    is_normalized: Optional[bool] = None
    is_present: Optional[bool] = None

class TeamScoreInDB(TeamScoreBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TeamScoreWithDetails(TeamScoreInDB):
    team_name: Optional[str] = None
    round_name: Optional[str] = None
    event_name: Optional[str] = None

class TeamEvaluationRequest(BaseModel):
    criteria_scores: Dict[str, float]
    is_present: bool = True
