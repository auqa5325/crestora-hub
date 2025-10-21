from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.team import Team, TeamStatus
from app.models.rounds import UnifiedEvent, EventType, EventStatus
from app.models.evaluation import Evaluation
from typing import Dict, Any

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get comprehensive dashboard statistics"""
    
    # Team statistics
    total_teams = db.query(Team).count()
    active_teams = db.query(Team).filter(Team.status == TeamStatus.ACTIVE).count()
    eliminated_teams = db.query(Team).filter(Team.status == TeamStatus.ELIMINATED).count()
    completed_teams = db.query(Team).filter(Team.status == TeamStatus.COMPLETED).count()
    
    # Event statistics - Get only main events (round_number = 0)
    base_query = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0)
    total_events = base_query.count()
    title_events = base_query.filter(UnifiedEvent.type == EventType.TITLE).count()
    rolling_events = base_query.filter(UnifiedEvent.type == EventType.ROLLING).count()
    active_events = base_query.filter(UnifiedEvent.status == EventStatus.IN_PROGRESS).count()
    completed_events = base_query.filter(UnifiedEvent.status == EventStatus.COMPLETED).count()
    
    # Round statistics
    ongoing_rounds = db.query(Team).with_entities(
        Team.current_round, 
        func.count(Team.id).label('count')
    ).filter(Team.status == TeamStatus.ACTIVE).group_by(Team.current_round).all()
    
    # Calculate total ongoing rounds
    total_ongoing_rounds = len(ongoing_rounds)
    
    # Prize pool (mock data for now)
    prize_pool = 12600  # This can be made dynamic later
    
    return {
        "teams": {
            "total": total_teams,
            "active": active_teams,
            "eliminated": eliminated_teams,
            "completed": completed_teams
        },
        "events": {
            "total": total_events,
            "title_events": title_events,
            "rolling_events": rolling_events,
            "active": active_events,
            "completed": completed_events
        },
        "rounds": {
            "ongoing": total_ongoing_rounds,
            "breakdown": {f"round_{r.current_round}": r.count for r in ongoing_rounds}
        },
        "prize_pool": prize_pool
    }

@router.get("/recent-activities")
async def get_recent_activities(db: Session = Depends(get_db)):
    """Get recent activities for dashboard"""
    
    # Recent events (last 5)
    recent_events = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0).order_by(UnifiedEvent.created_at.desc()).limit(5).all()
    
    # Recent teams (last 5)
    recent_teams = db.query(Team).order_by(Team.created_at.desc()).limit(5).all()
    
    # Recent evaluations (last 5)
    recent_evaluations = db.query(Evaluation).order_by(Evaluation.created_at.desc()).limit(5).all()
    
    return {
        "recent_events": [
            {
                "id": event.id,
                "name": event.name,
                "status": event.status.value,
                "type": event.type.value,
                "created_at": event.created_at
            }
            for event in recent_events
        ],
        "recent_teams": [
            {
                "team_id": team.team_id,
                "team_name": team.team_name,
                "leader_name": team.leader_name,
                "current_round": team.current_round,
                "status": team.status.value,
                "created_at": team.created_at
            }
            for team in recent_teams
        ],
        "recent_evaluations": [
            {
                "id": eval.id,
                "team_id": eval.team_id,
                "event_id": eval.event_id,
                "score": eval.score,
                "evaluator": eval.evaluator_name,
                "created_at": eval.created_at
            }
            for eval in recent_evaluations
        ]
    }

@router.get("/progress")
async def get_progress_stats(db: Session = Depends(get_db)):
    """Get progress statistics for dashboard"""
    
    # Events progress
    total_events = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0).count()
    completed_events = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.status == EventStatus.COMPLETED
    ).count()
    events_progress = (completed_events / total_events * 100) if total_events > 0 else 0
    
    # Teams evaluation progress
    total_teams = db.query(Team).count()
    evaluated_teams = db.query(Evaluation).with_entities(
        func.count(func.distinct(Evaluation.team_id))
    ).scalar() or 0
    teams_progress = (evaluated_teams / total_teams * 100) if total_teams > 0 else 0
    
    # Rounds progress
    total_rounds = db.query(UnifiedEvent).filter(UnifiedEvent.round_number > 0).count()
    completed_rounds = db.query(Evaluation).with_entities(
        func.count(func.distinct(Evaluation.round_id))
    ).scalar() or 0
    rounds_progress = (completed_rounds / total_rounds * 100) if total_rounds > 0 else 0
    
    return {
        "events_completed": {
            "completed": completed_events,
            "total": total_events,
            "percentage": round(events_progress, 1)
        },
        "teams_evaluated": {
            "evaluated": evaluated_teams,
            "total": total_teams,
            "percentage": round(teams_progress, 1)
        },
        "rounds_completed": {
            "completed": completed_rounds,
            "total": total_rounds,
            "percentage": round(rounds_progress, 1)
        }
    }
