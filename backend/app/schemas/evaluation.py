from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.evaluation import EvaluationStatus

class EvaluationBase(BaseModel):
    team_id: str = Field(..., max_length=20)
    event_id: str = Field(..., max_length=20)
    round_id: int
    evaluator_name: str = Field(..., max_length=100)
    score: float = Field(..., ge=0)
    max_score: float = Field(default=100.0, ge=0)
    feedback: Optional[str] = None
    status: EvaluationStatus = EvaluationStatus.PENDING

class EvaluationCreate(EvaluationBase):
    pass

class EvaluationUpdate(BaseModel):
    evaluator_name: Optional[str] = Field(None, max_length=100)
    score: Optional[float] = Field(None, ge=0)
    max_score: Optional[float] = Field(None, ge=0)
    feedback: Optional[str] = None
    status: Optional[EvaluationStatus] = None

class EvaluationInDB(EvaluationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EvaluationWithDetails(EvaluationInDB):
    team_name: Optional[str] = None
    event_name: Optional[str] = None
    round_name: Optional[str] = None

class EvaluationStats(BaseModel):
    total_evaluations: int
    pending_evaluations: int
    in_progress_evaluations: int
    completed_evaluations: int
    average_score: Optional[float] = None
    evaluations_by_round: dict
