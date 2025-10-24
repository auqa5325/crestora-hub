from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, Date, Boolean, Float, JSON
from sqlalchemy.sql import func
from app.database import Base
import enum

class EventType(str, enum.Enum):
    TITLE = "title"
    ROLLING = "rolling"

class EventStatus(str, enum.Enum):
    UPCOMING = "upcoming"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class EventMode(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"

class UnifiedEvent(Base):
    """
    Unified events table that combines both events and rounds into a single table.
    Each row represents either:
    1. A main event (round_number = 0)
    2. A specific round of an event (round_number > 0)
    """
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True)
    
    # Event identification
    event_id = Column(String(20), nullable=False, index=True)  # Same for all rounds of an event
    event_code = Column(String(20), nullable=False)  # Same for all rounds of an event
    
    # Round identification (0 = main event, 1+ = specific rounds)
    round_number = Column(Integer, nullable=False, default=0)
    
    # Event/Round details
    name = Column(String(200), nullable=False)
    type = Column(Enum(EventType), nullable=False)  # title or rolling
    mode = Column(Enum(EventMode), nullable=True)  # online or offline (null for main event)
    
    # Organization
    club = Column(String(100), nullable=True)  # Which club organizes this round (null for main event)
    
    # Timing
    date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)  # For main event
    end_date = Column(Date, nullable=True)    # For main event
    
    # Location
    venue = Column(String(200), nullable=True)
    
    # Content
    description = Column(Text, nullable=True)
    extended_description = Column(Text, nullable=True)  # Extended description for more details
    
    # Contact and Form Information
    form_link = Column(String(500), nullable=True)  # Link to registration/form
    contact = Column(String(200), nullable=True)  # Contact information
    
    # Status (applies to both events and rounds)
    status = Column(Enum(EventStatus), default=EventStatus.UPCOMING)
    
    # Round-specific fields
    round_code = Column(String(50), unique=True, nullable=True, index=True)
    participated_count = Column(Integer, default=0)
    shortlisted_teams = Column(JSON, nullable=True)  # Array of team_ids
    is_evaluated = Column(Boolean, default=False)
    is_frozen = Column(Boolean, default=False)
    criteria = Column(JSON, nullable=True)  # Array of {name, max_points}
    max_score = Column(Float, nullable=True)
    min_score = Column(Float, nullable=True)
    avg_score = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        if self.round_number == 0:
            return f"<Event(event_id='{self.event_id}', name='{self.name}')>"
        else:
            return f"<Round(event_id='{self.event_id}', round={self.round_number}, name='{self.name}')>"

    @property
    def is_main_event(self):
        """Returns True if this is the main event record (round_number = 0)"""
        return self.round_number == 0
    
    @property
    def is_round(self):
        """Returns True if this is a specific round record (round_number > 0)"""
        return self.round_number > 0
