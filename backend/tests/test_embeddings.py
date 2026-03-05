"""Tests for embedding generation service."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.embeddings import (
    get_embedding,
    chunk_summary,
    chunk_transcript,
)


# --- chunk_summary tests ---


class TestChunkSummary:
    def test_creates_four_chunks_from_full_summary(self):
        """chunk_summary creates 4 chunks when all sections are present."""
        summary = {
            "overview": "Team discussed Q4 roadmap.",
            "key_topics": ["Q4 roadmap", "Budget"],
            "decisions": ["Prioritize API migration"],
            "follow_ups": ["Draft timeline by Friday"],
        }
        chunks = chunk_summary(summary, "meeting-123")
        assert len(chunks) == 4

    def test_handles_empty_summary(self):
        """chunk_summary returns empty list for empty summary."""
        chunks = chunk_summary({}, "meeting-123")
        assert chunks == []

    def test_handles_missing_sections(self):
        """chunk_summary creates fewer chunks when sections are missing."""
        summary = {
            "overview": "Short meeting.",
        }
        chunks = chunk_summary(summary, "meeting-123")
        assert len(chunks) == 1
        assert chunks[0]["chunk_index"] == 0

    def test_chunk_text_prefixes(self):
        """chunk_summary chunk text has correct prefixes for each section."""
        summary = {
            "overview": "We reviewed the sprint.",
            "key_topics": ["Sprint review"],
            "decisions": ["Ship v2.0"],
            "follow_ups": ["Update docs"],
        }
        chunks = chunk_summary(summary, "meeting-123")
        assert chunks[0]["chunk_text"].startswith("Meeting Overview:")
        assert chunks[1]["chunk_text"].startswith("Key Topics Discussed:")
        assert chunks[2]["chunk_text"].startswith("Decisions Made:")
        assert chunks[3]["chunk_text"].startswith("Follow-ups:")

    def test_chunk_indices_are_sequential(self):
        """chunk_summary assigns sequential chunk indices."""
        summary = {
            "overview": "Overview",
            "key_topics": ["Topic"],
            "decisions": ["Decision"],
            "follow_ups": ["Follow-up"],
        }
        chunks = chunk_summary(summary, "meeting-123")
        indices = [c["chunk_index"] for c in chunks]
        assert indices == [0, 1, 2, 3]

    def test_metadata_contains_meeting_id(self):
        """chunk_summary metadata includes meeting_id."""
        summary = {"overview": "Test"}
        chunks = chunk_summary(summary, "meeting-abc")
        assert chunks[0]["metadata"]["meeting_id"] == "meeting-abc"
        assert chunks[0]["metadata"]["section"] == "overview"

    def test_key_topics_as_string(self):
        """chunk_summary handles key_topics already as a string."""
        summary = {"key_topics": "Budget and Planning"}
        chunks = chunk_summary(summary, "meeting-123")
        assert len(chunks) == 1
        assert "Budget and Planning" in chunks[0]["chunk_text"]

    def test_decisions_as_list_joined(self):
        """chunk_summary joins list of decisions with semicolons."""
        summary = {"decisions": ["Ship v2", "Hire contractor"]}
        chunks = chunk_summary(summary, "meeting-123")
        assert "Ship v2; Hire contractor" in chunks[0]["chunk_text"]

    def test_skips_none_values(self):
        """chunk_summary skips sections that are None."""
        summary = {
            "overview": None,
            "key_topics": ["Topic"],
        }
        chunks = chunk_summary(summary, "meeting-123")
        assert len(chunks) == 1
        assert chunks[0]["chunk_text"].startswith("Key Topics Discussed:")


# --- chunk_transcript tests ---


class TestChunkTranscript:
    def test_empty_text_returns_empty(self):
        """chunk_transcript returns empty list for empty text."""
        assert chunk_transcript("", "meeting-123") == []
        assert chunk_transcript("   ", "meeting-123") == []
        assert chunk_transcript(None, "meeting-123") == []

    def test_short_text_creates_single_chunk(self):
        """chunk_transcript with short text creates a single chunk."""
        text = "Hello world this is a short transcript."
        chunks = chunk_transcript(text, "meeting-123", chunk_size=500, overlap=50)
        assert len(chunks) == 1
        assert chunks[0]["chunk_text"] == text

    def test_long_text_creates_multiple_chunks(self):
        """chunk_transcript creates correct number of chunks for long text."""
        # Create text with exactly 1000 words
        words = [f"word{i}" for i in range(1000)]
        text = " ".join(words)
        # chunk_size=500, overlap=50 -> first chunk 0-500, second 450-950, third 900-1000
        chunks = chunk_transcript(text, "meeting-123", chunk_size=500, overlap=50)
        assert len(chunks) == 3

    def test_overlap_produces_overlapping_content(self):
        """chunk_transcript overlap causes content to appear in consecutive chunks."""
        words = [f"word{i}" for i in range(600)]
        text = " ".join(words)
        chunks = chunk_transcript(text, "meeting-123", chunk_size=500, overlap=50)
        assert len(chunks) == 2
        # Last 50 words of first chunk should appear at start of second chunk
        first_words = chunks[0]["chunk_text"].split()
        second_words = chunks[1]["chunk_text"].split()
        # The overlap region: words 450-499 should be in both chunks
        overlap_from_first = first_words[-50:]
        overlap_from_second = second_words[:50]
        assert overlap_from_first == overlap_from_second

    def test_start_index_offset(self):
        """chunk_transcript respects start_index parameter."""
        text = "Hello world short text"
        chunks = chunk_transcript(text, "meeting-123", start_index=4)
        assert chunks[0]["chunk_index"] == 4

    def test_default_start_index(self):
        """chunk_transcript default start_index is 4."""
        text = "Hello world"
        chunks = chunk_transcript(text, "meeting-123")
        assert chunks[0]["chunk_index"] == 4

    def test_metadata_has_transcript_type(self):
        """chunk_transcript metadata has type=transcript."""
        text = "Some transcript content"
        chunks = chunk_transcript(text, "meeting-123")
        assert chunks[0]["metadata"]["type"] == "transcript"
        assert chunks[0]["metadata"]["meeting_id"] == "meeting-123"


# --- get_embedding tests ---


class TestGetEmbedding:
    @pytest.mark.asyncio
    async def test_success_returns_embedding(self):
        """get_embedding returns list of floats on success."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.1] * 768}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.embeddings.httpx.AsyncClient", return_value=mock_client):
            result = await get_embedding("test text", ollama_url="http://localhost:11434")
            assert result is not None
            assert len(result) == 768
            assert all(isinstance(v, float) for v in result)

    @pytest.mark.asyncio
    async def test_connection_error_returns_none(self):
        """get_embedding returns None on connection error."""
        mock_client = AsyncMock()
        mock_client.post.side_effect = Exception("Connection refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.embeddings.httpx.AsyncClient", return_value=mock_client):
            result = await get_embedding("test text", ollama_url="http://localhost:11434")
            assert result is None

    @pytest.mark.asyncio
    async def test_calls_correct_url(self):
        """get_embedding calls the correct Ollama API endpoint."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.5] * 768}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.embeddings.httpx.AsyncClient", return_value=mock_client):
            await get_embedding("hello", ollama_url="http://localhost:11434")
            mock_client.post.assert_called_once_with(
                "http://localhost:11434/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": "hello"},
            )

    @pytest.mark.asyncio
    async def test_strips_trailing_slash_from_url(self):
        """get_embedding strips trailing slash from ollama_url."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.5] * 768}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.embeddings.httpx.AsyncClient", return_value=mock_client):
            await get_embedding("hello", ollama_url="http://localhost:11434/")
            mock_client.post.assert_called_once_with(
                "http://localhost:11434/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": "hello"},
            )
