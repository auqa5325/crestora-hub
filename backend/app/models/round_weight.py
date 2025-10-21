from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class RoundWeight(Base):
    __tablename__ = "round_weights"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False, unique=True)
    weight_percentage = Column(Float, nullable=False, default=100.0)  # 25, 50, 75, 100, 200
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    round = relationship("UnifiedEvent", foreign_keys=[round_id])

    def __repr__(self):
        return f"<RoundWeight(round_id={self.round_id}, weight={self.weight_percentage}%)>"
