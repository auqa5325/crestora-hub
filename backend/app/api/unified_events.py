from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from app.database import get_db
from app.models.rounds import UnifiedEvent, EventType, EventStatus, EventMode
from app.schemas.unified_event import (
    UnifiedEventInDB, UnifiedEventCreate, UnifiedEventUpdate, 
    EventWithRounds, EventStats
)

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("/", response_model=List[EventWithRounds])
async def get_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    event_type: Optional[EventType] = None,
    status: Optional[EventStatus] = None,
    db: Session = Depends(get_db)
):
    """Get all events with their rounds"""
    # Get main events (round_number = 0)
    query = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0)
    
    if event_type:
        query = query.filter(UnifiedEvent.type == event_type)
    
    if status:
        query = query.filter(UnifiedEvent.status == status)
    
    main_events = query.offset(skip).limit(limit).all()
    
    # Build response with rounds
    result = []
    for event in main_events:
        # Get all rounds for this event
        rounds = db.query(UnifiedEvent).filter(
            UnifiedEvent.event_id == event.event_id,
            UnifiedEvent.round_number > 0
        ).order_by(UnifiedEvent.round_number).all()
        
        # Convert rounds to RoundInDB format
        rounds_data = []
        for round_data in rounds:
            rounds_data.append({
                "id": round_data.id,
                "event_id": round_data.event_id,
                "round_number": round_data.round_number,
                "name": round_data.name,
                "mode": round_data.mode,
                "club": round_data.club,
                "date": round_data.date,
                "description": round_data.description,
                "status": round_data.status,
                "created_at": round_data.created_at,
                "updated_at": round_data.updated_at
            })
        
        # Build event with rounds
        event_data = {
            "id": event.id,
            "event_id": event.event_id,
            "event_code": event.event_code,
            "name": event.name,
            "type": event.type,
            "start_date": event.start_date,
            "end_date": event.end_date,
            "venue": event.venue,
            "description": event.description,
            "status": event.status,
            "created_at": event.created_at,
            "updated_at": event.updated_at,
            "rounds": rounds_data
        }
        result.append(event_data)
    
    return result

@router.get("/stats", response_model=EventStats)
async def get_event_stats(db: Session = Depends(get_db)):
    """Get comprehensive event and round statistics"""
    # Event stats
    total_events = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0).count()
    title_events = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.type == EventType.TITLE
    ).count()
    rolling_events = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.type == EventType.ROLLING
    ).count()
    upcoming_events = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.status == EventStatus.UPCOMING
    ).count()
    in_progress_events = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.status == EventStatus.IN_PROGRESS
    ).count()
    completed_events = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.status == EventStatus.COMPLETED
    ).count()
    
    # Round stats
    total_rounds = db.query(UnifiedEvent).filter(UnifiedEvent.round_number > 0).count()
    upcoming_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number > 0,
        UnifiedEvent.status == EventStatus.UPCOMING
    ).count()
    in_progress_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number > 0,
        UnifiedEvent.status == EventStatus.IN_PROGRESS
    ).count()
    completed_rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number > 0,
        UnifiedEvent.status == EventStatus.COMPLETED
    ).count()
    
    return EventStats(
        total_events=total_events,
        title_events=title_events,
        rolling_events=rolling_events,
        upcoming_events=upcoming_events,
        in_progress_events=in_progress_events,
        completed_events=completed_events,
        total_rounds=total_rounds,
        upcoming_rounds=upcoming_rounds,
        in_progress_rounds=in_progress_rounds,
        completed_rounds=completed_rounds
    )

@router.get("/{event_id}", response_model=EventWithRounds)
async def get_event(event_id: str, db: Session = Depends(get_db)):
    """Get a specific event with all its rounds"""
    # Get main event
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == 0
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get all rounds for this event
    rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number > 0
    ).order_by(UnifiedEvent.round_number).all()
    
    # Convert rounds to RoundInDB format
    rounds_data = []
    for round_data in rounds:
        rounds_data.append({
            "id": round_data.id,
            "event_id": round_data.event_id,
            "round_number": round_data.round_number,
            "name": round_data.name,
            "mode": round_data.mode,
            "club": round_data.club,
            "date": round_data.date,
            "description": round_data.description,
            "status": round_data.status,
            "created_at": round_data.created_at,
            "updated_at": round_data.updated_at
        })
    
    return {
        "id": event.id,
        "event_id": event.event_id,
        "event_code": event.event_code,
        "name": event.name,
        "type": event.type,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "venue": event.venue,
        "description": event.description,
        "status": event.status,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "rounds": rounds_data
    }

@router.post("/", response_model=UnifiedEventInDB)
async def create_event(event_data: UnifiedEventCreate, db: Session = Depends(get_db)):
    """Create a new event or round"""
    # Check if event_id already exists for main events
    if event_data.round_number == 0:
        existing_event = db.query(UnifiedEvent).filter(
            UnifiedEvent.event_id == event_data.event_id,
            UnifiedEvent.round_number == 0
        ).first()
        if existing_event:
            raise HTTPException(status_code=400, detail="Event ID already exists")
    
    # Check if round already exists
    if event_data.round_number > 0:
        existing_round = db.query(UnifiedEvent).filter(
            UnifiedEvent.event_id == event_data.event_id,
            UnifiedEvent.round_number == event_data.round_number
        ).first()
        if existing_round:
            raise HTTPException(status_code=400, detail="Round already exists for this event")
    
    # Create new event/round
    db_event = UnifiedEvent(**event_data.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    return db_event

@router.put("/{event_id}/{round_number}", response_model=UnifiedEventInDB)
async def update_event_or_round(
    event_id: str,
    round_number: int,
    event_update: UnifiedEventUpdate,
    db: Session = Depends(get_db)
):
    """Update an event or round"""
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == round_number
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event or round not found")
    
    # Update only provided fields
    update_data = event_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    
    db.commit()
    db.refresh(event)
    
    return event

@router.delete("/{event_id}")
async def delete_event(event_id: str, db: Session = Depends(get_db)):
    """Delete an event and all its rounds"""
    events = db.query(UnifiedEvent).filter(UnifiedEvent.event_id == event_id).all()
    
    if not events:
        raise HTTPException(status_code=404, detail="Event not found")
    
    for event in events:
        db.delete(event)
    
    db.commit()
    
    return {"message": "Event and all rounds deleted successfully"}

@router.delete("/{event_id}/{round_number}")
async def delete_round(event_id: str, round_number: int, db: Session = Depends(get_db)):
    """Delete a specific round"""
    round_data = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == round_number
    ).first()
    
    if not round_data:
        raise HTTPException(status_code=404, detail="Round not found")
    
    # Check if round is frozen or evaluated - prevent deletion
    if round_data.is_frozen or round_data.is_evaluated:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete frozen or evaluated rounds. Only upcoming rounds can be deleted."
        )
    
    # Delete related data first to avoid foreign key constraints
    from app.models.team_score import TeamScore
    from app.models.round_weight import RoundWeight
    from app.models.evaluation import Evaluation
    
    try:
        # Delete evaluations for this specific round
        evaluations_deleted = db.query(Evaluation).filter(
            Evaluation.round_id == round_data.id
        ).delete()
        print(f"Deleted {evaluations_deleted} evaluations for round {round_data.id}")
        
        # Delete team scores for this specific round
        team_scores_deleted = db.query(TeamScore).filter(
            TeamScore.round_id == round_data.id
        ).delete()
        print(f"Deleted {team_scores_deleted} team scores for round {round_data.id}")
        
        # Delete round weights
        round_weights_deleted = db.query(RoundWeight).filter(
            RoundWeight.round_id == round_data.id
        ).delete()
        print(f"Deleted {round_weights_deleted} round weights for round {round_data.id}")
        
        # Commit the related data deletions first
        db.commit()
        
        # Temporarily disable foreign key checks to handle the event_id constraint
        # This is safe because we've already deleted all related data for this specific round
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        
        # Now delete the round
        db.delete(round_data)
        db.commit()
        
        # Re-enable foreign key checks
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        
    except Exception as e:
        db.rollback()
        # Make sure to re-enable foreign key checks even if there's an error
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        except:
            pass
        print(f"Error during deletion process: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete round: {str(e)}")
    
    return {"message": "Round deleted successfully"}
