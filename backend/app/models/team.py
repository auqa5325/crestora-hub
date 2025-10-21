from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TeamStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ELIMINATED = "ELIMINATED"
    COMPLETED = "COMPLETED"

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(String(20), unique=True, nullable=False, index=True)  # CRES-96DA2
    team_name = Column(String(100), nullable=False)
    leader_name = Column(String(100), nullable=False)
    leader_register_number = Column(String(20), nullable=False)
    leader_contact = Column(String(15), nullable=False)
    leader_email = Column(String(100), nullable=False)
    password = Column(String(255), nullable=False)
    current_round = Column(Integer, default=1)
    status = Column(Enum(TeamStatus), default=TeamStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    # evaluations = relationship("Evaluation", back_populates="team")  # Commented out for now

    def __repr__(self):
        return f"<Team(team_id='{self.team_id}', team_name='{self.team_name}')>"

class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(String(20), ForeignKey("teams.team_id"), nullable=False)
    member_name = Column(String(100), nullable=False)
    register_number = Column(String(20), nullable=False)
    member_position = Column(String(20), nullable=False)  # leader, member2, member3, member4
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    team = relationship("Team", back_populates="members")

    def __repr__(self):
        return f"<TeamMember(name='{self.member_name}', position='{self.member_position}')>"
