"""Meeting upload, paste, and retrieval endpoints."""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    status,
)
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_client
from app.models.meeting import (
    MeetingResponse,
    MeetingUploadResponse,
    MeetingReviewData,
    ReviewConfirmation,
    DocumentSuggestionRequest,
    GenerateDocumentRequest,
)
from app.services.transcript import normalise_transcript, validate_transcript
from app.services import storage
from app.services.processing import process_meeting
from app.ai.provider import LLMProvider
from app.ai.factory import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/meetings", tags=["meetings"])

MAX_FILE_SIZE = 512000  # 500KB


class PasteRequest(BaseModel):
    """Request body for the paste endpoint."""

    text: str
    title: Optional[str] = None
    meeting_date: Optional[str] = None
    project_id: Optional[str] = None


class ActionItemUpdate(BaseModel):
    """A single action item for bulk save."""

    id: Optional[str] = None
    description: str
    owner_name: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "not_started"


class ActionItemsBulkRequest(BaseModel):
    """Request body for bulk action item save."""

    action_items: list[ActionItemUpdate]


class SummaryUpdateRequest(BaseModel):
    """Request body for updating a meeting summary."""

    overview: str = Field(description="A 2-3 sentence overview of the meeting")
    key_topics: list[str] = Field(description="Main topics discussed")
    decisions: list[str] = Field(description="Decisions made during the meeting")
    follow_ups: list[str] = Field(description="Follow-up items or next steps mentioned")


@router.post("/upload", response_model=MeetingUploadResponse, status_code=202)
async def upload_transcript(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    meeting_date: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
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

    # Trigger background AI processing
    background_tasks.add_task(
        process_meeting,
        meeting_id=meeting_id,
        transcript_text=normalised,
        provider=provider,
        user_id=user.id,
    )

    return MeetingUploadResponse(meeting_id=meeting_id, status="pending")


@router.post("/paste", response_model=MeetingUploadResponse, status_code=202)
async def paste_transcript(
    body: PasteRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
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

    # Trigger background AI processing
    background_tasks.add_task(
        process_meeting,
        meeting_id=meeting_id,
        transcript_text=normalised,
        provider=provider,
        user_id=user.id,
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


@router.post("/{meeting_id}/reprocess", status_code=202)
async def reprocess_meeting(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
) -> dict:
    """Re-trigger AI processing for a meeting."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Reset status
    await storage.update_meeting_status(meeting_id, "uploaded")

    # Re-trigger processing
    background_tasks.add_task(
        process_meeting,
        meeting_id=meeting_id,
        transcript_text=meeting["transcript_text"],
        provider=provider,
        user_id=user.id,
    )

    return {"meeting_id": meeting_id, "status": "pending"}


@router.get("/{meeting_id}/action-items")
async def get_action_items(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Get action items for a meeting."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    supabase = get_supabase_client()
    result = (
        supabase.table("action_items")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("user_id", user.id)
        .execute()
    )

    return {"action_items": result.data}


@router.put("/{meeting_id}/action-items")
async def bulk_save_action_items(
    meeting_id: str,
    body: ActionItemsBulkRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Bulk save action items: creates new, updates existing, deletes removed."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    supabase = get_supabase_client()

    # Get existing action items
    existing = (
        supabase.table("action_items")
        .select("id")
        .eq("meeting_id", meeting_id)
        .eq("user_id", user.id)
        .execute()
    )
    existing_ids = {item["id"] for item in existing.data}

    # Determine which items to keep/update
    incoming_ids = {item.id for item in body.action_items if item.id}

    # Delete items not in the incoming list
    to_delete = existing_ids - incoming_ids
    for item_id in to_delete:
        supabase.table("action_items").delete().eq("id", item_id).execute()

    # Upsert items
    for item in body.action_items:
        data = {
            "meeting_id": meeting_id,
            "user_id": user.id,
            "description": item.description,
            "owner_name": item.owner_name,
            "due_date": item.due_date,
            "status": item.status,
        }
        if item.id and item.id in existing_ids:
            # Update existing
            supabase.table("action_items").update(data).eq("id", item.id).execute()
        else:
            # Insert new
            supabase.table("action_items").insert(data).execute()

    return {"status": "ok"}


@router.put("/{meeting_id}/summary")
async def update_summary(
    meeting_id: str,
    body: SummaryUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Update the summary for a meeting."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    supabase = get_supabase_client()
    supabase.table("meetings").update({
        "summary": body.model_dump(),
    }).eq("id", meeting_id).execute()

    return {"status": "ok"}


class LinkProjectRequest(BaseModel):
    """Request body for linking/unlinking a meeting to a project."""

    project_id: Optional[str] = None


@router.put("/{meeting_id}/project")
async def link_meeting_to_project(
    meeting_id: str,
    body: LinkProjectRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Link or unlink a meeting to/from a project."""
    supabase = get_supabase_client()
    project_id = body.project_id
    result = (
        supabase.table("meetings")
        .update({"project_id": project_id})
        .eq("id", meeting_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )
    return {"project_id": project_id}


@router.get("/{meeting_id}/review-data")
async def get_review_data(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get all data needed for the review page."""
    from app.services.projects import get_projects
    from app.services.people import get_people

    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Get action items
    supabase = get_supabase_client()
    action_items_result = (
        supabase.table("action_items")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("user_id", user.id)
        .order("created_at")
        .execute()
    )

    # Get available projects and people for dropdowns
    projects = await get_projects(user.id)
    people = await get_people(user.id)

    # Resolve suggested project name
    suggested_project_name = None
    if meeting.get("suggested_project_id"):
        for p in projects:
            if p["id"] == meeting["suggested_project_id"]:
                suggested_project_name = p["name"]
                break

    return MeetingReviewData(
        id=meeting["id"],
        title=meeting.get("title"),
        meeting_date=meeting.get("meeting_date"),
        status=meeting["status"],
        review_status=meeting.get("review_status"),
        meeting_type=meeting.get("meeting_type"),
        meeting_type_confidence=meeting.get("meeting_type_confidence"),
        suggested_project_id=meeting.get("suggested_project_id"),
        suggested_project_name=suggested_project_name,
        summary=meeting.get("summary"),
        action_items=action_items_result.data,
        available_projects=[{"id": p["id"], "name": p["name"]} for p in projects],
        available_people=[{"id": p["id"], "name": p["name"]} for p in people],
    )


@router.post("/{meeting_id}/confirm-review")
async def confirm_review(
    meeting_id: str,
    body: ReviewConfirmation,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Save review edits and mark meeting as reviewed."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    supabase = get_supabase_client()

    # Update meeting fields
    update_data = {"review_status": "reviewed"}
    if body.meeting_type is not None:
        update_data["meeting_type"] = body.meeting_type
    if body.project_id is not None:
        update_data["project_id"] = body.project_id
    if body.summary is not None:
        update_data["summary"] = body.summary

    supabase.table("meetings").update(update_data).eq("id", meeting_id).execute()

    # Update action items if provided
    if body.action_items is not None:
        for item in body.action_items:
            if item.deleted and item.id:
                supabase.table("action_items").delete().eq("id", item.id).execute()
            elif item.id:
                supabase.table("action_items").update({
                    "description": item.description,
                    "owner_name": item.owner_name,
                    "owner_id": item.owner_id,
                    "due_date": item.due_date,
                    "status": item.status,
                }).eq("id", item.id).execute()
            else:
                supabase.table("action_items").insert({
                    "meeting_id": meeting_id,
                    "user_id": user.id,
                    "description": item.description,
                    "owner_name": item.owner_name,
                    "owner_id": item.owner_id,
                    "due_date": item.due_date,
                    "status": item.status or "not_started",
                }).execute()

    return {"status": "reviewed"}


@router.post("/{meeting_id}/skip-review")
async def skip_review(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Skip review and mark meeting as reviewed."""
    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    supabase = get_supabase_client()
    supabase.table("meetings").update({
        "review_status": "reviewed",
    }).eq("id", meeting_id).execute()

    return {"status": "reviewed"}


@router.post("/{meeting_id}/suggest-documents")
async def suggest_documents(
    meeting_id: str,
    body: DocumentSuggestionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
):
    """Generate document suggestions based on meeting content."""
    from app.ai.schemas import DocumentSuggestionsResult
    from app.ai.prompt_renderer import render_prompt

    prompt = render_prompt(
        "suggest_documents.j2",
        meeting_type=body.meeting_type or "general",
        summary_overview=body.summary_overview or "",
        key_topics=body.key_topics,
        decisions=body.decisions,
    )

    result = await provider.generate_structured(
        messages=[{"role": "user", "content": prompt}],
        response_model=DocumentSuggestionsResult,
    )

    return result.suggestions


@router.post("/{meeting_id}/generate-document")
async def generate_document(
    meeting_id: str,
    body: GenerateDocumentRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
):
    """Generate a specific document from meeting data."""
    from app.ai.prompt_renderer import render_prompt

    meeting = await storage.get_meeting(meeting_id, user.id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    supabase = get_supabase_client()
    action_items_result = (
        supabase.table("action_items")
        .select("description, owner_name, due_date")
        .eq("meeting_id", meeting_id)
        .execute()
    )

    summary = meeting.get("summary") or {}
    doc_type_labels = {
        "follow_up_email": "Follow-Up Email",
        "meeting_minutes": "Meeting Minutes",
        "project_update": "Project Update",
        "decision_log": "Decision Log",
    }

    prompt = render_prompt(
        "generate_document.j2",
        doc_type_label=doc_type_labels.get(body.doc_type, body.doc_type),
        meeting_date=meeting.get("meeting_date"),
        meeting_type=meeting.get("meeting_type"),
        summary_overview=summary.get("overview", ""),
        key_topics=summary.get("key_topics", []),
        decisions=summary.get("decisions", []),
        action_items=action_items_result.data,
    )

    result = await provider.generate(
        messages=[{"role": "user", "content": prompt}],
    )

    return {"doc_type": body.doc_type, "content": result}
