from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.rolling_results import RollingEventResult
from app.models.rounds import UnifiedEvent
from app.schemas.rolling_results import (
    RollingResultInDB, RollingResultCreate, RollingResultUpdate, RollingResultWithEvent
)
from app.auth import require_pda_role, require_clubs, get_current_user
from app.services.export_service import ExportService

router = APIRouter(prefix="/api/rolling-results", tags=["rolling-results"])

@router.get("/", response_model=List[RollingResultWithEvent])
async def get_rolling_results(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    club: Optional[str] = None,
    is_frozen: Optional[bool] = None,
    is_evaluated: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all rolling event results with optional filtering"""
    query = db.query(RollingEventResult)
    
    # Filter by club if user is club representative
    if current_user.role == "clubs":
        query = query.filter(RollingEventResult.club == current_user.club)
    elif club:
        query = query.filter(RollingEventResult.club == club)
    
    if is_frozen is not None:
        query = query.filter(RollingEventResult.is_frozen == is_frozen)
    
    if is_evaluated is not None:
        query = query.filter(RollingEventResult.is_evaluated == is_evaluated)
    
    results = query.offset(skip).limit(limit).all()
    
    # Enrich with event information
    enriched_results = []
    for result in results:
        event = db.query(UnifiedEvent).filter(
            UnifiedEvent.event_id == result.event_id,
            UnifiedEvent.round_number == 0
        ).first()
        
        result_dict = {
            "id": result.id,
            "event_id": result.event_id,
            # Winner details
            "winner_name": result.winner_name,
            "winner_register_number": result.winner_register_number,
            "winner_email": result.winner_email,
            "winner_phone": result.winner_phone,
            "winner_department": result.winner_department,
            "winner_year": result.winner_year,
            # Runner-up details
            "runner_up_name": result.runner_up_name,
            "runner_up_register_number": result.runner_up_register_number,
            "runner_up_email": result.runner_up_email,
            "runner_up_phone": result.runner_up_phone,
            "runner_up_department": result.runner_up_department,
            "runner_up_year": result.runner_up_year,
            "club": result.club,
            "is_frozen": result.is_frozen,
            "is_evaluated": result.is_evaluated,
            "created_at": result.created_at,
            "updated_at": result.updated_at,
            "event_name": event.name if event else None,
            "event_date": event.start_date.isoformat() if event and event.start_date else None
        }
        enriched_results.append(result_dict)
    
    return enriched_results

@router.get("/export")
async def export_rolling_results(
    is_frozen: Optional[bool] = None,
    is_evaluated: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export rolling event results to CSV"""
    
    # Filter by club if user is club representative
    if current_user.role == "clubs":
        # For club users, only export their club's results
        club_results = db.query(RollingEventResult).filter(
            RollingEventResult.club == current_user.club
        ).all()
        
        # Apply additional filters
        if is_frozen is not None:
            club_results = [r for r in club_results if r.is_frozen == is_frozen]
        if is_evaluated is not None:
            club_results = [r for r in club_results if r.is_evaluated == is_evaluated]
        
        # Create a temporary export service and modify it to work with filtered results
        export_service = ExportService(db)
        return export_service.export_rolling_results(is_frozen, is_evaluated)
    else:
        # For admin users, export all results
        export_service = ExportService(db)
        return export_service.export_rolling_results(is_frozen, is_evaluated)

@router.get("/{event_id}", response_model=RollingResultWithEvent)
async def get_rolling_result_by_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get rolling event result for a specific event"""
    result = db.query(RollingEventResult).filter(
        RollingEventResult.event_id == event_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Rolling event result not found")
    
    # Check access permissions
    if current_user.role == "clubs" and result.club != current_user.club:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich with event information
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == 0
    ).first()
    
    return {
        "id": result.id,
        "event_id": result.event_id,
        # Winner details
        "winner_name": result.winner_name,
        "winner_register_number": result.winner_register_number,
        "winner_email": result.winner_email,
        "winner_phone": result.winner_phone,
        "winner_department": result.winner_department,
        "winner_year": result.winner_year,
        # Runner-up details
        "runner_up_name": result.runner_up_name,
        "runner_up_register_number": result.runner_up_register_number,
        "runner_up_email": result.runner_up_email,
        "runner_up_phone": result.runner_up_phone,
        "runner_up_department": result.runner_up_department,
        "runner_up_year": result.runner_up_year,
        "club": result.club,
        "is_frozen": result.is_frozen,
        "is_evaluated": result.is_evaluated,
        "created_at": result.created_at,
        "updated_at": result.updated_at,
        "event_name": event.name if event else None,
        "event_date": event.start_date.isoformat() if event and event.start_date else None
    }

@router.post("/", response_model=RollingResultInDB)
async def create_rolling_result(
    result_data: RollingResultCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create or update rolling event result"""
    # Check if event exists and is a rolling event
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == result_data.event_id,
        UnifiedEvent.round_number == 0,
        UnifiedEvent.type == "rolling"
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Rolling event not found")
    
    # Check access permissions
    if current_user.role == "clubs" and result_data.club != current_user.club:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if result already exists
    existing_result = db.query(RollingEventResult).filter(
        RollingEventResult.event_id == result_data.event_id
    ).first()
    
    if existing_result:
        # Update existing result
        for field, value in result_data.dict().items():
            setattr(existing_result, field, value)
        db.commit()
        db.refresh(existing_result)
        return existing_result
    else:
        # Create new result
        db_result = RollingEventResult(**result_data.dict())
        db.add(db_result)
        db.commit()
        db.refresh(db_result)
        return db_result

@router.put("/{event_id}", response_model=RollingResultInDB)
async def update_rolling_result(
    event_id: str,
    result_update: RollingResultUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update rolling event result"""
    result = db.query(RollingEventResult).filter(
        RollingEventResult.event_id == event_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Rolling event result not found")
    
    # Check access permissions
    if current_user.role == "clubs" and result.club != current_user.club:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if result is frozen (only PDA can update frozen results)
    if result.is_frozen and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot update frozen result")
    
    # Update fields
    for field, value in result_update.dict(exclude_unset=True).items():
        setattr(result, field, value)
    
    db.commit()
    db.refresh(result)
    return result

@router.post("/{event_id}/freeze")
async def freeze_rolling_result(
    event_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Freeze rolling event result"""
    result = db.query(RollingEventResult).filter(
        RollingEventResult.event_id == event_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Rolling event result not found")
    
    # Check access permissions
    if current_user.role == "clubs" and result.club != current_user.club:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if result.is_frozen:
        raise HTTPException(status_code=400, detail="Result is already frozen")
    
    result.is_frozen = True
    db.commit()
    
    return {"message": "Rolling event result frozen successfully"}

@router.post("/{event_id}/evaluate")
async def evaluate_rolling_result(
    event_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Evaluate rolling event result (PDA only)"""
    result = db.query(RollingEventResult).filter(
        RollingEventResult.event_id == event_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Rolling event result not found")
    
    if not result.is_frozen:
        raise HTTPException(status_code=400, detail="Result must be frozen before evaluation")
    
    if result.is_evaluated:
        raise HTTPException(status_code=400, detail="Result is already evaluated")
    
    result.is_evaluated = True
    db.commit()
    
    return {"message": "Rolling event result evaluated successfully"}

@router.get("/events/available", response_model=List[dict])
async def get_available_rolling_events(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get available rolling events for result entry"""
    query = db.query(UnifiedEvent).filter(
        UnifiedEvent.round_number == 0,
        UnifiedEvent.type == "rolling"
    )
    
    # Filter by club if user is club representative
    if current_user.role == "clubs":
        # For rolling events, filter by the club that organizes the main event (round_number = 0)
        query = query.filter(UnifiedEvent.club == current_user.club)
    
    events = query.all()
    
    return [
        {
            "event_id": event.event_id,
            "name": event.name,
            "club": event.club or "Multiple clubs",
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "venue": event.venue
        }
        for event in events
    ]
