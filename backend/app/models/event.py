from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
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

class RoundType(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"

class RoundStatus(str, enum.Enum):
    UPCOMING = "upcoming"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    event_code = Column(String(20), nullable=False)
    type = Column(Enum(EventType), nullable=False)
    status = Column(Enum(EventStatus), default=EventStatus.UPCOMING)
    start_date = Column(Date)
    end_date = Column(Date)
    venue = Column(String(200))
    description = Column(Text)
    max_rounds = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    rounds = relationship("Round", back_populates="event", cascade="all, delete-orphan")
    # evaluations = relationship("Evaluation", back_populates="event")  # Commented out for now

    def __repr__(self):
        return f"<Event(event_id='{self.event_id}', name='{self.name}')>"

class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(20), ForeignKey("events.event_id"), nullable=False)
    round_number = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    club = Column(String(100))
    type = Column(Enum(RoundType), nullable=False)
    date = Column(Date)
    description = Column(Text)
    status = Column(Enum(RoundStatus), default=RoundStatus.UPCOMING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="rounds")
    # evaluations = relationship("Evaluation", back_populates="round")  # Commented out for now

    def __repr__(self):
        return f"<Round(round_number={self.round_number}, name='{self.name}')>"
