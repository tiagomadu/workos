"""Meeting upload, paste, and retrieval endpoints."""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.models.meeting import MeetingResponse, MeetingUploadResponse
from app.services.transcript import normalise_transcript, validate_transcript
from app.services import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/meetings", tags=["meetings"])

MAX_FILE_SIZE = 512000  # 500KB


class PasteRequest(BaseModel):
    """Request body for the paste endpoint."""

    text: str
    title: Optional[str] = None
    meeting_date: Optional[str] = None
    project_id: Optional[str] = None


@router.post("/upload", response_model=MeetingUploadResponse, status_code=202)
async def upload_transcript(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    meeting_date: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
    user: AuthenticatedUser = Depends(get_current_user),
) -> MeetingUploadResponse:
    """Upload a .txt transcript file for processing."""
    # Validate file extension
    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(
            status_code=422,
            detail="Only .txt files are accepted",
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail="File exceeds 500KB limit",
        )

    # Decode and normalise
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=422,
            detail="File must be valid UTF-8 text",
        )

    normalised = normalise_transcript(text)

    # Upload to storage
    transcript_path = await storage.upload_transcript(
        user_id=user.id,
        filename=file.filename,
        content=normalised.encode("utf-8"),
    )

    # Create meeting record
    meeting_id = await storage.create_meeting_record(
        user_id=user.id,
        transcript_path=transcript_path,
        raw_transcript=normalised,
        title=title,
        meeting_date=meeting_date,
    )

    return MeetingUploadResponse(meeting_id=meeting_id, status="pending")


@router.post("/paste", response_model=MeetingUploadResponse, status_code=202)
async def paste_transcript(
    body: PasteRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> MeetingUploadResponse:
    """Paste transcript text directly for processing."""
    # Validate
    is_valid, error_msg = validate_transcript(body.text)
    if not is_valid:
        raise HTTPException(
            status_code=422,
            detail=error_msg,
        )

    normalised = normalise_transcript(body.text)

    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"pasted_{timestamp}.txt"

    # Upload to storage
    transcript_path = await storage.upload_transcript(
        user_id=user.id,
        filename=filename,
        content=normalised.encode("utf-8"),
    )

    # Create meeting record
    meeting_id = await storage.create_meeting_record(
        user_id=user.id,
        transcript_path=transcript_path,
        raw_transcript=normalised,
        title=body.title,
        meeting_date=body.meeting_date,
    )

    return MeetingUploadResponse(meeting_id=meeting_id, status="pending")


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> MeetingResponse:
    """Get meeting details by ID for the authenticated user."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )
    return MeetingResponse(**meeting)
