from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class EvaluationStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(String(20), ForeignKey("teams.team_id"), nullable=False)
    event_id = Column(String(20), ForeignKey("events.event_id"), nullable=False)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    evaluator_name = Column(String(100), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, default=100.0)
    feedback = Column(Text)
    status = Column(Enum(EvaluationStatus), default=EvaluationStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # team = relationship("Team", back_populates="evaluations")  # Commented out for now
    # event = relationship("Event", back_populates="evaluations")  # Commented out for now
    # round = relationship("Round", back_populates="evaluations")  # Commented out for now

    def __repr__(self):
        return f"<Evaluation(team_id='{self.team_id}', score={self.score})>"
