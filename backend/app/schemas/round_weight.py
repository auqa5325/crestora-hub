from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class RoundWeightBase(BaseModel):
    round_id: int
    weight_percentage: float = Field(..., ge=25, le=200)  # 25, 50, 75, 100, 200

class RoundWeightCreate(RoundWeightBase):
    pass

class RoundWeightUpdate(BaseModel):
    weight_percentage: float = Field(..., ge=25, le=200)

class RoundWeightInDB(RoundWeightBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RoundWeightWithDetails(RoundWeightInDB):
    round_name: Optional[str] = None
    event_name: Optional[str] = None
