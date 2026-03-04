"""Meeting transcript processing pipeline."""

import logging
from datetime import datetime, timezone, timedelta

from app.ai.provider import LLMProvider
from app.ai.schemas import MeetingSummary, ActionItemsResult, MeetingTypeResult
from app.ai.prompt_renderer import render_prompt
from app.services.storage import update_meeting_status
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


async def process_meeting(
    meeting_id: str,
    transcript_text: str,
    provider: LLMProvider,
    user_id: str,
) -> None:
    """Process a meeting transcript through the AI pipeline.

    Steps:
    1. Detect meeting type
    2. Generate summary
    3. Extract action items
    """
    try:
        # Step 1: Detect meeting type
        logger.info("Meeting %s: detecting type", meeting_id)
        await update_meeting_status(meeting_id, "detecting_type")

        type_prompt = render_prompt("detect_meeting_type.j2", transcript=transcript_text)
        type_result = await provider.generate_structured(
            messages=[{"role": "user", "content": type_prompt}],
            response_model=MeetingTypeResult,
        )

        # Save meeting type to DB
        supabase = get_supabase_client()
        supabase.table("meetings").update({
            "meeting_type": type_result.meeting_type,
            "meeting_type_confidence": type_result.confidence,
        }).eq("id", meeting_id).execute()

        # Step 2: Generate summary
        logger.info("Meeting %s: generating summary", meeting_id)
        await update_meeting_status(meeting_id, "summarizing")

        summary_prompt = render_prompt("summarize_meeting.j2", transcript=transcript_text)
        summary_result = await provider.generate_structured(
            messages=[{"role": "user", "content": summary_prompt}],
            response_model=MeetingSummary,
        )

        # Save summary to DB as JSONB
        supabase.table("meetings").update({
            "summary": summary_result.model_dump(),
        }).eq("id", meeting_id).execute()

        # Step 3: Extract action items
        logger.info("Meeting %s: extracting action items", meeting_id)
        await update_meeting_status(meeting_id, "extracting_actions")

        action_prompt = render_prompt(
            "extract_action_items.j2",
            transcript=transcript_text,
            summary=summary_result.overview,
        )
        action_result = await provider.generate_structured(
            messages=[{"role": "user", "content": action_prompt}],
            response_model=ActionItemsResult,
        )

        # Save action items to DB
        default_due = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
        for item in action_result.action_items:
            supabase.table("action_items").insert({
                "meeting_id": meeting_id,
                "user_id": user_id,
                "description": item.description,
                "owner_name": item.owner_name,
                "due_date": item.due_date or default_due,
                "status": "not_started",
            }).execute()

        # Mark as completed
        logger.info("Meeting %s: processing complete", meeting_id)
        await update_meeting_status(meeting_id, "completed")

    except Exception as e:
        logger.error("Meeting %s: processing failed: %s", meeting_id, str(e), exc_info=True)
        await update_meeting_status(meeting_id, "failed", error_message=str(e))
