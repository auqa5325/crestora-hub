from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.rolling_results import Department, Year

class RollingResultBase(BaseModel):
    event_id: str = Field(..., max_length=20)
    
    # Winner details
    winner_name: str = Field(..., max_length=100)
    winner_register_number: str = Field(..., max_length=20)
    winner_email: str = Field(..., max_length=100)
    winner_phone: str = Field(..., max_length=15)
    winner_department: Department
    winner_year: Year
    
    # Runner-up details
    runner_up_name: str = Field(..., max_length=100)
    runner_up_register_number: str = Field(..., max_length=20)
    runner_up_email: str = Field(..., max_length=100)
    runner_up_phone: str = Field(..., max_length=15)
    runner_up_department: Department
    runner_up_year: Year
    
    club: str = Field(..., max_length=100)
    is_frozen: bool = False
    is_evaluated: bool = False

class RollingResultCreate(RollingResultBase):
    pass

class RollingResultUpdate(BaseModel):
    # Winner details
    winner_name: Optional[str] = Field(None, max_length=100)
    winner_register_number: Optional[str] = Field(None, max_length=20)
    winner_email: Optional[str] = Field(None, max_length=100)
    winner_phone: Optional[str] = Field(None, max_length=15)
    winner_department: Optional[Department] = None
    winner_year: Optional[Year] = None
    
    # Runner-up details
    runner_up_name: Optional[str] = Field(None, max_length=100)
    runner_up_register_number: Optional[str] = Field(None, max_length=20)
    runner_up_email: Optional[str] = Field(None, max_length=100)
    runner_up_phone: Optional[str] = Field(None, max_length=15)
    runner_up_department: Optional[Department] = None
    runner_up_year: Optional[Year] = None
    
    is_frozen: Optional[bool] = None
    is_evaluated: Optional[bool] = None

class RollingResultInDB(RollingResultBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RollingResultWithEvent(RollingResultInDB):
    event_name: Optional[str] = None
    event_date: Optional[str] = None
