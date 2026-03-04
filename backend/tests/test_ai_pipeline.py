"""Integration tests for the AI processing pipeline with mocked LLM and Supabase."""

from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from app.services.processing import process_meeting


def _make_mock_supabase():
    """Create a mock Supabase client with chainable table operations."""
    mock_supabase = MagicMock()

    # Make table().update().eq().execute() chainable
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])

    return mock_supabase


@pytest.mark.asyncio
class TestProcessMeeting:
    @patch("app.services.processing.get_supabase_client")
    @patch("app.services.processing.update_meeting_status", new_callable=AsyncMock)
    async def test_runs_all_three_steps(
        self,
        mock_update_status: AsyncMock,
        mock_get_supabase: MagicMock,
        mock_llm_provider,
    ):
        """Test that process_meeting runs type detection, summarization, and action extraction."""
        mock_supabase = _make_mock_supabase()
        mock_get_supabase.return_value = mock_supabase

        await process_meeting(
            meeting_id="meeting-123",
            transcript_text="Alice: Let's review the sprint.\nBob: Sure.",
            provider=mock_llm_provider,
            user_id="user-456",
        )

        # Verify all status transitions happened in order
        status_calls = [c.args for c in mock_update_status.call_args_list]
        assert ("meeting-123", "detecting_type") in status_calls
        assert ("meeting-123", "summarizing") in status_calls
        assert ("meeting-123", "extracting_actions") in status_calls
        assert ("meeting-123", "completed") in status_calls

        # Verify Supabase was called to save results
        table_calls = [c.args[0] for c in mock_supabase.table.call_args_list]
        assert "meetings" in table_calls
        assert "action_items" in table_calls

    @patch("app.services.processing.get_supabase_client")
    @patch("app.services.processing.update_meeting_status", new_callable=AsyncMock)
    async def test_sets_failed_status_on_llm_error(
        self,
        mock_update_status: AsyncMock,
        mock_get_supabase: MagicMock,
    ):
        """Test that process_meeting sets failed status when LLM raises an exception."""
        mock_supabase = _make_mock_supabase()
        mock_get_supabase.return_value = mock_supabase

        # Create a provider that fails
        class FailingProvider:
            async def generate_structured(self, messages, response_model, **kwargs):
                raise RuntimeError("LLM service unavailable")

            async def health_check(self):
                return False

        await process_meeting(
            meeting_id="meeting-789",
            transcript_text="Some transcript text.",
            provider=FailingProvider(),
            user_id="user-456",
        )

        # Verify it set "failed" status with error message
        final_call = mock_update_status.call_args_list[-1]
        assert final_call.args[0] == "meeting-789"
        assert final_call.args[1] == "failed"
        assert "LLM service unavailable" in final_call.kwargs.get("error_message", "")

    @patch("app.services.processing.get_supabase_client")
    @patch("app.services.processing.update_meeting_status", new_callable=AsyncMock)
    async def test_saves_meeting_type_to_db(
        self,
        mock_update_status: AsyncMock,
        mock_get_supabase: MagicMock,
        mock_llm_provider,
    ):
        """Test that detected meeting type is saved to the meetings table."""
        mock_supabase = _make_mock_supabase()
        mock_get_supabase.return_value = mock_supabase

        await process_meeting(
            meeting_id="meeting-123",
            transcript_text="Alice: How are things going?\nBob: Great.",
            provider=mock_llm_provider,
            user_id="user-456",
        )

        # Find the update call that saves meeting type
        update_calls = mock_supabase.table.return_value.update.call_args_list
        type_saved = False
        for c in update_calls:
            data = c.args[0] if c.args else c.kwargs.get("data", {})
            if "meeting_type" in data:
                assert data["meeting_type"] == "team_huddle"
                assert data["meeting_type_confidence"] == "high"
                type_saved = True
        assert type_saved, "Meeting type was not saved to database"

    @patch("app.services.processing.get_supabase_client")
    @patch("app.services.processing.update_meeting_status", new_callable=AsyncMock)
    async def test_saves_action_items_to_db(
        self,
        mock_update_status: AsyncMock,
        mock_get_supabase: MagicMock,
        mock_llm_provider,
    ):
        """Test that extracted action items are inserted into the action_items table."""
        mock_supabase = _make_mock_supabase()
        mock_get_supabase.return_value = mock_supabase

        await process_meeting(
            meeting_id="meeting-123",
            transcript_text="Alice: Bob, please draft the timeline by Friday.",
            provider=mock_llm_provider,
            user_id="user-456",
        )

        # The mock provider returns 2 action items, so we expect 2 insert calls
        insert_calls = mock_supabase.table.return_value.insert.call_args_list
        assert len(insert_calls) == 2

        # Check first action item
        first_data = insert_calls[0].args[0]
        assert first_data["meeting_id"] == "meeting-123"
        assert first_data["user_id"] == "user-456"
        assert first_data["description"] == "Draft timeline"
        assert first_data["owner_name"] == "Bob"
        assert first_data["status"] == "not_started"
