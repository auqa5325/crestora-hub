from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.rounds import UnifiedEvent, EventType, EventStatus, EventMode
from app.schemas.unified_event import RoundInDB

router = APIRouter(prefix="/api/public", tags=["public-events"])

@router.get("/rounds")
async def get_public_rounds(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: Session = Depends(get_db)
):
    """
    Get all rounds - PUBLIC ACCESS (No authentication required)
    
    Returns a list of all rounds with their complete information.
    This endpoint is publicly accessible and doesn't require authentication.
    """
    try:
        # Get all rounds (round_number > 0) directly
        rounds = db.query(UnifiedEvent).filter(
            UnifiedEvent.round_number > 0
        ).order_by(UnifiedEvent.event_id, UnifiedEvent.round_number).offset(skip).limit(limit).all()
        
        # Convert rounds to simple format
        rounds_data = []
        for round_data in rounds:
            round_dict = {
                "id": round_data.id,
                "event_id": round_data.event_id,
                "round_number": round_data.round_number,
                "name": round_data.name,
                "mode": round_data.mode,
                "club": round_data.club,
                "date": round_data.date,
                "description": round_data.description,
                "extended_description": round_data.extended_description,
                "form_link": round_data.form_link,
                "contact": round_data.contact,
                "venue": round_data.venue,
                "status": round_data.status,
                "round_code": round_data.round_code,
                "participated_count": round_data.participated_count,
                "shortlisted_teams": round_data.shortlisted_teams,
                "is_evaluated": round_data.is_evaluated,
                "is_frozen": round_data.is_frozen,
                "is_wildcard": round_data.is_wildcard,
                "criteria": round_data.criteria,
                "max_score": round_data.max_score,
                "min_score": round_data.min_score,
                "avg_score": round_data.avg_score,
                "created_at": round_data.created_at,
                "updated_at": round_data.updated_at
            }
            rounds_data.append(round_dict)
        
        return {"rounds": rounds_data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/rolling-events")
async def get_public_rolling_events(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: Session = Depends(get_db)
):
    """
    Get all rolling events - PUBLIC ACCESS (No authentication required)
    
    Returns a list of all rolling events with their complete information.
    This endpoint is publicly accessible and doesn't require authentication.
    """
    try:
        # Get rolling events (type = rolling, round_number = 0)
        rolling_events = db.query(UnifiedEvent).filter(
            UnifiedEvent.type == EventType.ROLLING,
            UnifiedEvent.round_number == 0
        ).offset(skip).limit(limit).all()
        
        # Convert to response format
        result = []
        for event in rolling_events:
            event_data = {
                "id": event.id,
                "event_id": event.event_id,
                "event_code": event.event_code,
                "name": event.name,
                "type": event.type,
                "club": event.club,
                "date": event.date,
                "start_date": event.start_date,
                "end_date": event.end_date,
                "venue": event.venue,
                "description": event.description,
                "extended_description": event.extended_description,
                "form_link": event.form_link,
                "contact": event.contact,
                "status": event.status,
                "created_at": event.created_at,
                "updated_at": event.updated_at
            }
            result.append(event_data)
        
        return {"rolling_events": result}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

