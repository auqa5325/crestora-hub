from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.rounds import UnifiedEvent, EventType, EventStatus, EventMode
from app.schemas.event import Event as EventSchema, EventCreate, EventUpdate, EventStats

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("/")
async def get_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    event_type: Optional[EventType] = None,
    status: Optional[EventStatus] = None,
    db: Session = Depends(get_db)
):
    """Get all events with optional filtering"""
    # Get only main events (round_number = 0)
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
        
        # Convert rounds to Round format
        rounds_data = []
        for round_data in rounds:
            rounds_data.append({
                "id": round_data.id,
                "event_id": round_data.event_id,
                "round_number": round_data.round_number,
                "name": round_data.name,
                "club": round_data.club,
                "mode": round_data.mode.value if round_data.mode else None,  # Map mode to string
                "date": round_data.date.isoformat() if round_data.date else None,
                "description": round_data.description,
                "status": round_data.status.value,
                "round_code": round_data.round_code,
                "participated_count": round_data.participated_count,
                "shortlisted_teams": round_data.shortlisted_teams,
                "is_evaluated": round_data.is_evaluated,
                "is_frozen": round_data.is_frozen,
                "criteria": round_data.criteria,
                "max_score": round_data.max_score,
                "min_score": round_data.min_score,
                "avg_score": round_data.avg_score,
                "created_at": round_data.created_at.isoformat() if round_data.created_at else None,
                "updated_at": round_data.updated_at.isoformat() if round_data.updated_at else None
            })
        
        # Build event with rounds
        event_data = {
            "id": event.id,
            "event_id": event.event_id,
            "event_code": event.event_code,
            "name": event.name,
            "type": event.type.value,
            "status": event.status.value,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "venue": event.venue,
            "description": event.description,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "updated_at": event.updated_at.isoformat() if event.updated_at else None,
            "rounds": rounds_data
        }
        result.append(event_data)
    
    return result

@router.get("/stats", response_model=EventStats)
async def get_event_stats(db: Session = Depends(get_db)):
    """Get event statistics"""
    # Get only main events (round_number = 0)
    base_query = db.query(UnifiedEvent).filter(UnifiedEvent.round_number == 0)
    total_events = base_query.count()
    title_events = base_query.filter(UnifiedEvent.type == EventType.TITLE).count()
    rolling_events = base_query.filter(UnifiedEvent.type == EventType.ROLLING).count()
    upcoming_events = base_query.filter(UnifiedEvent.status == EventStatus.UPCOMING).count()
    in_progress_events = base_query.filter(UnifiedEvent.status == EventStatus.IN_PROGRESS).count()
    completed_events = base_query.filter(UnifiedEvent.status == EventStatus.COMPLETED).count()
    
    return EventStats(
        total_events=total_events,
        title_events=title_events,
        rolling_events=rolling_events,
        upcoming_events=upcoming_events,
        in_progress_events=in_progress_events,
        completed_events=completed_events
    )

@router.get("/{event_id}", response_model=EventSchema)
async def get_event(event_id: str, db: Session = Depends(get_db)):
    """Get a specific event by event_id"""
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id, 
        UnifiedEvent.round_number == 0
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.get("/{event_id}/rounds", response_model=List[dict])
async def get_event_rounds(event_id: str, db: Session = Depends(get_db)):
    """Get all rounds for a specific event"""
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id, 
        UnifiedEvent.round_number == 0
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    rounds = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number > 0
    ).order_by(UnifiedEvent.round_number).all()
    return rounds

@router.post("/", response_model=EventSchema)
async def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    """Create a new event"""
    # Check if event_id already exists
    existing_event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_data.event_id,
        UnifiedEvent.round_number == 0
    ).first()
    if existing_event:
        raise HTTPException(status_code=400, detail="Event ID already exists")
    
    # Create main event (round_number = 0)
    db_event = UnifiedEvent(
        event_id=event_data.event_id,
        event_code=event_data.event_code,
        round_number=0,  # Main event
        name=event_data.name,
        type=event_data.type,
        status=event_data.status,
        start_date=event_data.start_date,
        end_date=event_data.end_date,
        venue=event_data.venue,
        description=event_data.description
    )
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # Add rounds
    for round_data in event_data.rounds:
        db_round = UnifiedEvent(
            event_id=db_event.event_id,
            event_code=db_event.event_code,
            round_number=round_data.round_number,
            name=round_data.name,
            club=round_data.club,
            mode=round_data.type,  # Map type to mode
            date=round_data.date,
            description=round_data.description,
            status=round_data.status
        )
        db.add(db_round)
    
    db.commit()
    db.refresh(db_event)
    
    return db_event

@router.put("/{event_id}", response_model=EventSchema)
async def update_event(
    event_id: str, 
    event_update: EventUpdate, 
    db: Session = Depends(get_db)
):
    """Update an event"""
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == 0
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Update only provided fields
    update_data = event_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    
    db.commit()
    db.refresh(event)
    
    return event

@router.delete("/{event_id}")
async def delete_event(event_id: str, db: Session = Depends(get_db)):
    """Delete an event"""
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == 0
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Delete all rounds for this event first
    db.query(UnifiedEvent).filter(UnifiedEvent.event_id == event_id).delete()
    db.commit()
    
    return {"message": "Event deleted successfully"}
