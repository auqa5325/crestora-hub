from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
from app.models.rounds import EventType, EventStatus, EventMode

class RoundBase(BaseModel):
    round_number: int
    name: str
    club: Optional[str] = None
    type: EventMode
    date: Optional[date] = None
    description: Optional[str] = None
    status: EventStatus = EventStatus.UPCOMING

    class Config:
        from_attributes = True

class RoundCreate(RoundBase):
    pass

class Round(RoundBase):
    id: int
    event_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    event_id: str
    name: str
    event_code: str
    type: EventType
    status: EventStatus = EventStatus.UPCOMING
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue: Optional[str] = None
    description: Optional[str] = None
    max_rounds: int = 1

class EventCreate(EventBase):
    rounds: List[RoundCreate] = []

class EventUpdate(BaseModel):
    name: Optional[str] = None
    event_code: Optional[str] = None
    status: Optional[EventStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue: Optional[str] = None
    description: Optional[str] = None
    max_rounds: Optional[int] = None

class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    rounds: List[Round] = []

    class Config:
        from_attributes = True

class EventStats(BaseModel):
    total_events: int
    title_events: int
    rolling_events: int
    upcoming_events: int
    in_progress_events: int
    completed_events: int
