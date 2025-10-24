from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from app.models.rounds import EventType, EventStatus, EventMode

class UnifiedEventBase(BaseModel):
    event_id: str = Field(..., max_length=20)
    event_code: str = Field(..., max_length=20)
    round_number: int = Field(..., ge=0)
    name: str = Field(..., max_length=200)
    type: EventType
    mode: Optional[EventMode] = None
    club: Optional[str] = Field(None, max_length=100)
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    extended_description: Optional[str] = None
    form_link: Optional[str] = Field(None, max_length=500)
    contact: Optional[str] = Field(None, max_length=200)
    status: EventStatus = EventStatus.UPCOMING
    # Round-specific fields
    round_code: Optional[str] = Field(None, max_length=50)
    participated_count: int = 0
    shortlisted_teams: Optional[List[str]] = None  # Array of team_ids
    is_evaluated: bool = False
    is_frozen: bool = False
    criteria: Optional[List[Dict[str, Any]]] = None  # Array of {name, max_points}
    max_score: Optional[float] = None
    min_score: Optional[float] = None
    avg_score: Optional[float] = None

class UnifiedEventCreate(UnifiedEventBase):
    pass

class UnifiedEventUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    mode: Optional[EventMode] = None
    club: Optional[str] = Field(None, max_length=100)
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    extended_description: Optional[str] = None
    form_link: Optional[str] = Field(None, max_length=500)
    contact: Optional[str] = Field(None, max_length=200)
    status: Optional[EventStatus] = None
    round_code: Optional[str] = Field(None, max_length=50)
    participated_count: Optional[int] = None
    shortlisted_teams: Optional[List[str]] = None
    is_evaluated: Optional[bool] = None
    is_frozen: Optional[bool] = None
    criteria: Optional[List[Dict[str, Any]]] = None
    max_score: Optional[float] = None
    min_score: Optional[float] = None
    avg_score: Optional[float] = None

class UnifiedEventInDB(BaseModel):
    id: int
    event_id: str = Field(..., max_length=20)
    event_code: str = Field(..., max_length=20)
    round_number: int = Field(..., ge=0)
    name: str = Field(..., max_length=200)
    type: EventType
    mode: Optional[EventMode] = None
    club: Optional[str] = Field(None, max_length=100)
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    extended_description: Optional[str] = None
    form_link: Optional[str] = Field(None, max_length=500)
    contact: Optional[str] = Field(None, max_length=200)
    status: EventStatus = EventStatus.UPCOMING
    round_code: Optional[str] = Field(None, max_length=50)
    participated_count: int = 0
    shortlisted_teams: Optional[List[str]] = None
    is_evaluated: bool = False
    is_frozen: bool = False
    criteria: Optional[List[Dict[str, Any]]] = None
    max_score: Optional[float] = None
    min_score: Optional[float] = None
    avg_score: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Helper models for frontend consumption
class RoundInDB(BaseModel):
    """Represents a single round"""
    id: int
    event_id: str
    round_number: int
    name: str
    mode: Optional[EventMode] = None
    club: Optional[str] = None
    date: Optional[date] = None
    description: Optional[str] = None
    extended_description: Optional[str] = None
    form_link: Optional[str] = None
    contact: Optional[str] = None
    status: EventStatus
    # Round-specific fields
    round_code: Optional[str] = None
    participated_count: int = 0
    shortlisted_teams: Optional[List[str]] = None
    is_evaluated: bool = False
    is_frozen: bool = False
    criteria: Optional[List[Dict[str, Any]]] = None
    max_score: Optional[float] = None
    min_score: Optional[float] = None
    avg_score: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EventWithRounds(BaseModel):
    """Represents a main event with all its rounds"""
    id: int
    event_id: str
    event_code: str
    name: str
    type: EventType
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue: Optional[str] = None
    description: Optional[str] = None
    extended_description: Optional[str] = None
    form_link: Optional[str] = None
    contact: Optional[str] = None
    status: EventStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    rounds: List[RoundInDB] = []

class EventStats(BaseModel):
    total_events: int
    title_events: int
    rolling_events: int
    upcoming_events: int
    in_progress_events: int
    completed_events: int
    total_rounds: int
    upcoming_rounds: int
    in_progress_rounds: int
    completed_rounds: int

class RoundReorderItem(BaseModel):
    """Single round reorder item"""
    round_id: int
    new_round_number: int

class RoundReorderRequest(BaseModel):
    """Request to reorder rounds"""
    round_orders: List[RoundReorderItem]
