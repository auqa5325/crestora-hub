from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from app.models.team import TeamStatus

class TeamMemberBase(BaseModel):
    member_name: str
    register_number: str
    member_position: str

class TeamMemberCreate(TeamMemberBase):
    pass

class TeamMemberInDB(TeamMemberBase):
    id: int
    team_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class TeamBase(BaseModel):
    team_id: str
    team_name: str
    leader_name: str
    leader_register_number: str
    leader_contact: str
    leader_email: str
    current_round: int = 1
    status: TeamStatus = TeamStatus.ACTIVE

class TeamCreate(TeamBase):
    password: str
    members: List[TeamMemberCreate] = []

class TeamUpdate(BaseModel):
    team_name: Optional[str] = None
    leader_name: Optional[str] = None
    leader_contact: Optional[str] = None
    leader_email: Optional[str] = None
    current_round: Optional[int] = None
    status: Optional[TeamStatus] = None

class TeamInDB(TeamBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    members: List[TeamMemberInDB] = []
    # evaluations: List[Evaluation] = []  # Commented out for now

    class Config:
        from_attributes = True

class TeamStats(BaseModel):
    total_teams: int
    active_teams: int
    eliminated_teams: int
    completed_teams: int
    teams_by_round: dict
