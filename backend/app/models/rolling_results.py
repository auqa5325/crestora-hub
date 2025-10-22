from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class Department(str, enum.Enum):
    AI_DS = "Artificial Intelligence and Data Science"
    AEROSPACE = "Aerospace Engineering"
    AUTOMOBILE = "Automobile Engineering"
    COMPUTER_TECH = "Computer Technology"
    ECE = "Electronics and Communication Engineering"
    EIE = "Electronics and Instrumentation Engineering"
    PRODUCTION = "Production Technology"
    ROBOTICS = "Robotics and Automation"
    RUBBER_PLASTICS = "Rubber and Plastics Technology"
    IT = "Information Technology"

class Year(str, enum.Enum):
    FIRST = "1"
    SECOND = "2"
    THIRD = "3"
    FOURTH = "4"

class RollingEventResult(Base):
    __tablename__ = "rolling_event_results"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(20), nullable=False, index=True)  # Links to rolling events
    
    # Winner details
    winner_name = Column(String(100), nullable=False)
    winner_register_number = Column(String(20), nullable=False)
    winner_email = Column(String(100), nullable=False)
    winner_phone = Column(String(15), nullable=False)
    winner_department = Column(Enum(Department), nullable=False)
    winner_year = Column(Enum(Year), nullable=False)
    
    # Runner-up details
    runner_up_name = Column(String(100), nullable=False)
    runner_up_register_number = Column(String(20), nullable=False)
    runner_up_email = Column(String(100), nullable=False)
    runner_up_phone = Column(String(15), nullable=False)
    runner_up_department = Column(Enum(Department), nullable=False)
    runner_up_year = Column(Enum(Year), nullable=False)
    
    club = Column(String(100), nullable=False)  # Organizing club
    is_frozen = Column(Boolean, default=False)
    is_evaluated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<RollingEventResult(event_id='{self.event_id}', winner='{self.winner_name}', runner_up='{self.runner_up_name}')>"
