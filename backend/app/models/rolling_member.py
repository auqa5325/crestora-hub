from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class RollingMemberStatus(str, enum.Enum):
    ACTIVE = "active"
    ELIMINATED = "eliminated"
    COMPLETED = "completed"

class RollingEventMember(Base):
    __tablename__ = "rolling_event_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    register_number = Column(String(20), nullable=False)
    email = Column(String(100), nullable=False)
    contact = Column(String(15), nullable=False)
    event_id = Column(String(20), nullable=False, index=True)
    status = Column(Enum(RollingMemberStatus), default=RollingMemberStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<RollingEventMember(name='{self.name}', event_id='{self.event_id}')>"
