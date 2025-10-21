from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class TeamScore(Base):
    __tablename__ = "team_scores"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(String(20), ForeignKey("teams.team_id"), nullable=False)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    event_id = Column(String(20), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0)  # Normalized to 100
    criteria_scores = Column(JSON, nullable=True)  # {criteria_name: score}
    raw_total_score = Column(Float, nullable=False, default=0.0)
    is_normalized = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    team = relationship("Team", foreign_keys=[team_id])
    round = relationship("UnifiedEvent", foreign_keys=[round_id])

    def __repr__(self):
        return f"<TeamScore(team_id='{self.team_id}', round_id={self.round_id}, score={self.score})>"
