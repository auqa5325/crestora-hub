from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.rounds import UnifiedEvent, EventType, EventStatus, EventMode
from app.schemas.unified_event import (
    UnifiedEventInDB, UnifiedEventCreate, UnifiedEventUpdate, 
    EventWithRounds, EventStats
)
from app.schemas.team_score import TeamScoreInDB, TeamScoreUpdate
from app.services.round_service import RoundService
from app.services.export_service import ExportService
from app.services.gmail_service import gmail_service
from app.services.gmail_service_mock import mock_gmail_service
from app.auth import get_current_user, require_pda_role, require_club_or_pda
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rounds", tags=["rounds"])

class EmailRequest(BaseModel):
    to_emails: List[EmailStr]
    event_name: str = "Crestora'25"

# New round management endpoints
@router.post("/rounds", response_model=UnifiedEventInDB)
async def create_round(
    round_data: UnifiedEventCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Create a new round (PDA only)"""
    round_service = RoundService(db)
    return round_service.create_round(round_data.dict(), current_user.role)

@router.put("/rounds/{round_id}/criteria")
async def update_round_criteria(
    round_id: int,
    criteria: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Update evaluation criteria for a round"""
    round_service = RoundService(db)
    return round_service.update_criteria(round_id, criteria, current_user.role, current_user.club)

@router.get("/rounds/{round_id}/evaluations", response_model=List[TeamScoreInDB])
async def get_round_evaluations(
    round_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Get all team evaluations for a round"""
    round_service = RoundService(db)
    return round_service.get_round_evaluations(round_id, current_user.role, current_user.club)

@router.put("/rounds/{round_id}/evaluate/{team_id}")
async def evaluate_team(
    round_id: int,
    team_id: str,
    criteria_scores: Dict[str, float],
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Submit/update evaluation for a team"""
    round_service = RoundService(db)
    return round_service.evaluate_team(round_id, team_id, criteria_scores, current_user.role, current_user.club)

@router.post("/rounds/{round_id}/freeze")
async def freeze_round(
    round_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Freeze round evaluations and calculate statistics"""
    round_service = RoundService(db)
    return round_service.freeze_round(round_id, current_user.role, current_user.club)


@router.get("/rounds/{round_id}/stats")
async def get_round_stats(
    round_id: int,
    db: Session = Depends(get_db)
):
    """Get round statistics"""
    round_service = RoundService(db)
    return round_service.get_round_stats(round_id)

@router.get("/rounds/{round_id}/export")
async def export_round_data(
    round_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_club_or_pda())
):
    """Export round evaluations to CSV"""
    # Validate user has access to this round
    round_service = RoundService(db)
    round_service.validate_round_access(round_id, current_user.role, current_user.club)
    
    # Export the data
    export_service = ExportService(db)
    return export_service.export_round_data(round_id)

@router.post("/rounds/{round_id}/export-email")
async def export_round_data_via_email(
    round_id: int,
    email_request: EmailRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Export round evaluations as CSV and send via email (PDA only)"""
    
    # Validate user has access to this round
    round_service = RoundService(db)
    round_service.validate_round_access(round_id, current_user.role, current_user.club)
    
    # Use mock service for testing if Gmail is not authenticated
    email_service = gmail_service if gmail_service.is_authenticated() else mock_gmail_service
    
    if not gmail_service.is_authenticated():
        print("Using mock Gmail service for testing")
    
    try:
        # Get round information for email context
        round_data = db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_data:
            raise HTTPException(status_code=404, detail="Round not found")
        
        # Export the data using the existing export service
        export_service = ExportService(db)
        csv_response = export_service.export_round_data(round_id)
        
        # Get CSV content as bytes
        csv_content = csv_response.body.decode('utf-8')
        csv_bytes = csv_content.encode('utf-8')
        
        # Send email with CSV attachment
        try:
            success = email_service.send_email_with_attachment(
                to_emails=email_request.to_emails,
                subject=f"{email_request.event_name} - {round_data.name} Round Evaluation Export",
                body=f"""
                <html>
                <body>
                    <h2>{email_request.event_name} - {round_data.name} Round Evaluation</h2>
                    <p>Please find the attached CSV file with the round evaluation data.</p>
                    <p>This export includes:</p>
                    <ul>
                        <li>All team evaluations for {round_data.name}</li>
                        <li>Criteria scores and normalized scores</li>
                        <li>Team status and evaluation timestamps</li>
                    </ul>
                    <p><strong>Round Details:</strong></p>
                    <ul>
                        <li>Round: {round_data.name}</li>
                        <li>Event: {round_data.event_id}</li>
                        <li>Club: {round_data.club or 'N/A'}</li>
                    </ul>
                    <p>Best regards,<br>
                    Crestora'25 Team</p>
                </body>
                </html>
                """,
                attachment_data=csv_bytes,
                attachment_filename=f"round_{round_id}_{round_data.name.replace(' ', '_')}_evaluations.csv",
                attachment_mime_type="text/csv"
            )
            
            if success:
                return {
                    "message": f"Round evaluation CSV sent successfully to {len(email_request.to_emails)} recipient(s)",
                    "recipients": email_request.to_emails,
                    "round_name": round_data.name,
                    "event_name": email_request.event_name
                }
            else:
                raise HTTPException(
                    status_code=500, 
                    detail="Failed to send email. Please check the server logs for details."
                )
        except Exception as email_error:
            logger.error(f"Email sending failed: {str(email_error)}")
            
            # Check for Gmail API not enabled error
            if "accessNotConfigured" in str(email_error) or "Gmail API has not been used" in str(email_error):
                raise HTTPException(
                    status_code=503,
                    detail="Gmail API is not enabled. Please enable it in Google Cloud Console: https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=731275370587"
                )
            
            raise HTTPException(
                status_code=500, 
                detail=f"Email sending failed: {str(email_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to export and send round data: {str(e)}"
        )

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
        
        # Convert rounds to RoundInDB format using Pydantic model
        from app.schemas.unified_event import RoundInDB
        rounds_data = [RoundInDB.model_validate(round_data).model_dump(exclude_none=False) for round_data in rounds]
        
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

@router.put("/{event_id}/{round_number}")
async def update_event_or_round(
    event_id: str,
    round_number: int,
    event_update: UnifiedEventUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Update an event or round (PDA only)"""
    try:
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
        
        # Return the raw SQLAlchemy model - FastAPI will handle serialization
        return event
    except Exception as e:
        db.rollback()
        print(f"Error updating round: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update round: {str(e)}")

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
async def delete_round(
    event_id: str, 
    round_number: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Delete a specific round (PDA only)"""
    try:
        round_data = db.query(UnifiedEvent).filter(
            UnifiedEvent.event_id == event_id,
            UnifiedEvent.round_number == round_number
        ).first()
        
        if not round_data:
            raise HTTPException(status_code=404, detail="Round not found")
        
        # Delete related data first to avoid foreign key constraints
        from app.models.team_score import TeamScore
        from app.models.round_weight import RoundWeight
        
        # Delete team scores
        db.query(TeamScore).filter(TeamScore.round_id == round_data.id).delete()
        
        # Delete round weights
        db.query(RoundWeight).filter(RoundWeight.round_id == round_data.id).delete()
        
        # Now delete the round
        db.delete(round_data)
        db.commit()
        
        return {"message": "Round deleted successfully"}
    except Exception as e:
        db.rollback()
        print(f"Error deleting round: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete round: {str(e)}")

@router.post("/rounds/{round_id}/shortlist")
async def shortlist_teams(
    round_id: int,
    shortlist_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(require_pda_role())
):
    """Shortlist teams for a frozen round (PDA only)"""
    try:
        round_service = RoundService(db)
        
        shortlist_type = shortlist_data.get("type")  # "top_k" or "threshold"
        value = shortlist_data.get("value")  # K for top_k, threshold score for threshold
        
        if not shortlist_type or value is None:
            raise HTTPException(status_code=400, detail="Missing shortlist type or value")
        
        if shortlist_type not in ["top_k", "threshold"]:
            raise HTTPException(status_code=400, detail="Invalid shortlist type. Must be 'top_k' or 'threshold'")
        
        result = round_service.shortlist_teams(round_id, shortlist_type, value, current_user.role)
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"Error shortlisting teams: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to shortlist teams: {str(e)}")

