from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, Date
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
    
    # Status (applies to both events and rounds)
    status = Column(Enum(EventStatus), default=EventStatus.UPCOMING)
    
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
