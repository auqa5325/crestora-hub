from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.rolling_results import RollingEventResult
from app.models.rounds import UnifiedEvent
from app.schemas.rolling_results import (
    RollingResultInDB, RollingResultCreate, RollingResultUpdate, RollingResultWithEvent
)
from app.auth import require_pda_role, require_clubs, get_current_user
from app.services.export_service import ExportService
from app.services.s3_service import s3_service
import logging

logger = logging.getLogger(__name__)

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

@router.get("/files")
async def get_rolling_results_files(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get list of uploaded CSV files for rolling events"""
    
    try:
        # Check if S3 service is properly initialized
        if not s3_service.s3_client:
            logger.warning("S3 service not initialized - returning empty file list")
            return {"files": []}
        
        # Get all files from rollingresults folder
        files = s3_service.list_files("rollingresults/")
        
        # Filter files based on user permissions
        if current_user.role == "clubs":
            # For club users, only show files for their events
            user_events = db.query(UnifiedEvent).filter(
                UnifiedEvent.club == current_user.club,
                UnifiedEvent.round_number == 0,
                UnifiedEvent.type == "rolling"
            ).all()
            
            user_event_ids = [event.event_id for event in user_events]
            files = [f for f in files if f["eventName"] in user_event_ids]
        
        return {"files": files}
        
    except Exception as e:
        logger.error(f"Failed to list rolling results files: {str(e)}")
        # Return empty list instead of error to prevent frontend crashes
        return {"files": []}

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

@router.post("/upload-csv")
async def upload_rolling_results_csv(
    file: UploadFile = File(...),
    event_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload CSV file for rolling event results"""
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    # Check if event exists
    event = db.query(UnifiedEvent).filter(
        UnifiedEvent.event_id == event_id,
        UnifiedEvent.round_number == 0,
        UnifiedEvent.type == "rolling"
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Rolling event not found")
    
    # Check access permissions
    if current_user.role == "clubs" and event.club != current_user.club:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Check if S3 service is properly initialized
        if not s3_service.s3_client:
            logger.error("S3 service not initialized - cannot upload files")
            raise HTTPException(status_code=503, detail="File upload service not available. Please check AWS configuration.")
        
        # Read file content
        file_content = await file.read()
        
        # Generate folder path: rollingresults/{event_id}/
        folder_path = f"rollingresults/{event_id}/"
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{event_id}_{timestamp}_{file.filename}"
        
        # Upload to S3
        result = s3_service.upload_file(
            file_content=file_content,
            file_name=filename,
            folder_path=folder_path
        )
        
        logger.info(f"CSV uploaded for event {event_id} by user {current_user.username}")
        
        return {
            "message": "CSV file uploaded successfully",
            "file_key": result["file_key"],
            "file_url": result["file_url"],
            "event_id": event_id,
            "filename": filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload CSV for event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload CSV: {str(e)}")

@router.delete("/files/{file_key:path}")
async def delete_rolling_results_file(
    file_key: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a CSV file from rolling results"""
    
    try:
        # Extract event ID from file key
        # Format: rollingresults/{event_id}/{filename}
        if not file_key.startswith("rollingresults/"):
            raise HTTPException(status_code=400, detail="Invalid file key")
        
        path_parts = file_key.split('/')
        if len(path_parts) < 3:
            raise HTTPException(status_code=400, detail="Invalid file key format")
        
        event_id = path_parts[1]
        
        # Check if event exists and user has permission
        event = db.query(UnifiedEvent).filter(
            UnifiedEvent.event_id == event_id,
            UnifiedEvent.round_number == 0,
            UnifiedEvent.type == "rolling"
        ).first()
        
        if not event:
            raise HTTPException(status_code=404, detail="Rolling event not found")
        
        # Check access permissions
        if current_user.role == "clubs" and event.club != current_user.club:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete file from S3
        result = s3_service.delete_file(file_key)
        
        logger.info(f"File deleted: {file_key} by user {current_user.username}")
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete file {file_key}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
