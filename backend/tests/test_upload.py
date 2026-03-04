"""API endpoint tests for meeting upload, paste, and retrieval."""

import os
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _read_fixture_bytes(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as f:
        return f.read()


@pytest.mark.asyncio
class TestUploadEndpoint:
    """Tests for POST /api/v1/meetings/upload."""

    @patch("app.services.storage.create_meeting_record", new_callable=AsyncMock)
    @patch("app.services.storage.upload_transcript", new_callable=AsyncMock)
    async def test_valid_txt_upload_returns_202(
        self, mock_upload: AsyncMock, mock_create: AsyncMock, client: AsyncClient
    ) -> None:
        mock_upload.return_value = "test-user-id/2026/03/2026-03-04_sample.txt"
        mock_create.return_value = "meeting-uuid-123"

        content = _read_fixture_bytes("sample_plain.txt")
        response = await client.post(
            "/api/v1/meetings/upload",
            files={"file": ("sample.txt", content, "text/plain")},
        )

        assert response.status_code == 202
        data = response.json()
        assert data["meeting_id"] == "meeting-uuid-123"
        assert data["status"] == "pending"
        mock_upload.assert_called_once()
        mock_create.assert_called_once()

    async def test_pdf_upload_returns_422(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/meetings/upload",
            files={"file": ("report.pdf", b"fake pdf content", "application/pdf")},
        )
        assert response.status_code == 422
        assert "Only .txt files" in response.json()["detail"]

    @patch("app.services.storage.upload_transcript", new_callable=AsyncMock)
    async def test_oversized_file_returns_422(
        self, mock_upload: AsyncMock, client: AsyncClient
    ) -> None:
        # 600KB file — exceeds the 500KB limit
        oversized_content = b"x" * 600000
        response = await client.post(
            "/api/v1/meetings/upload",
            files={"file": ("big.txt", oversized_content, "text/plain")},
        )
        assert response.status_code == 422
        assert "500KB" in response.json()["detail"]
        mock_upload.assert_not_called()


@pytest.mark.asyncio
class TestPasteEndpoint:
    """Tests for POST /api/v1/meetings/paste."""

    @patch("app.services.storage.create_meeting_record", new_callable=AsyncMock)
    @patch("app.services.storage.upload_transcript", new_callable=AsyncMock)
    async def test_paste_returns_202(
        self, mock_upload: AsyncMock, mock_create: AsyncMock, client: AsyncClient
    ) -> None:
        mock_upload.return_value = "test-user-id/2026/03/2026-03-04_pasted.txt"
        mock_create.return_value = "meeting-uuid-456"

        response = await client.post(
            "/api/v1/meetings/paste",
            json={"text": "Alice: Hello\nBob: Hi"},
        )

        assert response.status_code == 202
        data = response.json()
        assert data["meeting_id"] == "meeting-uuid-456"
        assert data["status"] == "pending"

    async def test_paste_empty_text_returns_422(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/meetings/paste",
            json={"text": ""},
        )
        assert response.status_code == 422
        assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestGetMeetingEndpoint:
    """Tests for GET /api/v1/meetings/{meeting_id}."""

    @patch("app.services.storage.get_meeting", new_callable=AsyncMock)
    async def test_get_meeting_returns_data(
        self, mock_get: AsyncMock, client: AsyncClient
    ) -> None:
        mock_get.return_value = {
            "id": "meeting-uuid-123",
            "status": "completed",
            "title": "Q4 Planning",
            "meeting_type": "planning",
            "meeting_type_confidence": "high",
            "summary": {"key_points": ["Point 1"]},
            "error_message": None,
            "created_at": "2026-03-04T12:00:00Z",
            "llm_provider": "ollama",
        }

        response = await client.get("/api/v1/meetings/meeting-uuid-123")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "meeting-uuid-123"
        assert data["status"] == "completed"
        assert data["title"] == "Q4 Planning"

    @patch("app.services.storage.get_meeting", new_callable=AsyncMock)
    async def test_get_meeting_not_found_returns_404(
        self, mock_get: AsyncMock, client: AsyncClient
    ) -> None:
        mock_get.return_value = None

        response = await client.get("/api/v1/meetings/nonexistent-id")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
