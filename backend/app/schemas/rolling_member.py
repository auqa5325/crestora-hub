from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.rolling_member import RollingMemberStatus

class RollingMemberBase(BaseModel):
    name: str = Field(..., max_length=100)
    register_number: str = Field(..., max_length=20)
    email: str = Field(..., max_length=100)
    contact: str = Field(..., max_length=15)
    event_id: str = Field(..., max_length=20)
    status: RollingMemberStatus = RollingMemberStatus.ACTIVE

class RollingMemberCreate(RollingMemberBase):
    pass

class RollingMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    register_number: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    contact: Optional[str] = Field(None, max_length=15)
    status: Optional[RollingMemberStatus] = None

class RollingMemberInDB(RollingMemberBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
