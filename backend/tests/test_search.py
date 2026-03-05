"""Tests for search endpoint and RAG pipeline."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from pydantic import ValidationError

from app.ai.schemas import SearchAnswer


# --- SearchAnswer schema tests ---


class TestSearchAnswerSchema:
    def test_valid_answer(self):
        """SearchAnswer validates with a valid answer string."""
        result = SearchAnswer(answer="The team decided to ship v2.")
        assert result.answer == "The team decided to ship v2."

    def test_empty_answer_allowed(self):
        """SearchAnswer allows empty string."""
        result = SearchAnswer(answer="")
        assert result.answer == ""

    def test_missing_answer_raises(self):
        """SearchAnswer raises ValidationError when answer is missing."""
        with pytest.raises(ValidationError):
            SearchAnswer()


# --- Search endpoint tests ---


@pytest.mark.asyncio
class TestSearchEndpoint:
    async def test_search_returns_answer_and_sources(self, client):
        """Search endpoint returns answer and sources for a valid query."""
        mock_embedding = [0.1] * 768
        mock_matches = [
            {
                "id": "emb-1",
                "meeting_id": "meeting-1",
                "chunk_text": "We discussed the API migration timeline.",
                "similarity": 0.85,
            }
        ]
        mock_meetings = [
            {
                "id": "meeting-1",
                "title": "Sprint Planning",
                "meeting_date": "2026-03-01",
                "meeting_type": "team_huddle",
            }
        ]

        mock_supabase = MagicMock()

        # Mock rpc for match_documents
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data=mock_matches)
        mock_supabase.rpc.return_value = mock_rpc

        # Mock table for meetings enrichment
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.in_.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=mock_meetings)
        mock_supabase.table.return_value = mock_table

        mock_answer = SearchAnswer(answer="The team discussed migrating the API.")

        with patch("app.services.search.get_supabase_client", return_value=mock_supabase), \
             patch("app.services.search.get_embedding", new_callable=AsyncMock, return_value=mock_embedding), \
             patch("app.services.search.create_llm_provider") as mock_provider_factory:
            mock_provider = AsyncMock()
            mock_provider.generate_structured.return_value = mock_answer
            mock_provider_factory.return_value = mock_provider

            response = await client.get("/api/v1/search", params={"q": "API migration"})

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert data["answer"] == "The team discussed migrating the API."
        assert len(data["sources"]) == 1
        assert data["sources"][0]["meeting_id"] == "meeting-1"
        assert data["sources"][0]["meeting_title"] == "Sprint Planning"

    async def test_search_empty_query_returns_422(self, client):
        """Search endpoint returns 422 for empty query."""
        response = await client.get("/api/v1/search", params={"q": ""})
        assert response.status_code == 422

    async def test_search_missing_query_returns_422(self, client):
        """Search endpoint returns 422 when q parameter is missing."""
        response = await client.get("/api/v1/search")
        assert response.status_code == 422

    async def test_search_handles_no_results(self, client):
        """Search endpoint handles no matching results gracefully."""
        mock_embedding = [0.1] * 768

        mock_supabase = MagicMock()
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data=[])
        mock_supabase.rpc.return_value = mock_rpc

        with patch("app.services.search.get_supabase_client", return_value=mock_supabase), \
             patch("app.services.search.get_embedding", new_callable=AsyncMock, return_value=mock_embedding):
            response = await client.get("/api/v1/search", params={"q": "nonexistent topic"})

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert data["sources"] == []
        assert "No relevant meetings" in data["answer"]

    async def test_search_handles_embedding_failure(self, client):
        """Search endpoint handles embedding generation failure gracefully."""
        with patch("app.services.search.get_embedding", new_callable=AsyncMock, return_value=None):
            response = await client.get("/api/v1/search", params={"q": "test query"})

        assert response.status_code == 200
        data = response.json()
        assert "unavailable" in data["answer"].lower() or "ollama" in data["answer"].lower()
        assert data["sources"] == []
