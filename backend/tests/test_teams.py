"""Tests for teams CRUD endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


MOCK_TEAM_ROW = {
    "id": "team-uuid-1",
    "user_id": "test-user-id",
    "name": "Engineering",
    "description": "The engineering team",
    "lead_id": None,
    "created_at": "2026-03-04T12:00:00Z",
    "updated_at": "2026-03-04T12:00:00Z",
}


@pytest.mark.asyncio
class TestCreateTeam:
    """Tests for POST /api/v1/teams."""

    @patch("app.services.people.get_supabase_client")
    async def test_create_team_returns_201(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        mock_t = MagicMock()
        mock_t.insert.return_value.execute.return_value = MagicMock(
            data=[MOCK_TEAM_ROW]
        )
        mock_client.table.return_value = mock_t

        response = await client.post(
            "/api/v1/teams",
            json={"name": "Engineering", "description": "The engineering team"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Engineering"
        assert data["id"] == "team-uuid-1"

    async def test_create_team_without_name_returns_422(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/api/v1/teams",
            json={"description": "No name provided"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestListTeams:
    """Tests for GET /api/v1/teams."""

    @patch("app.services.people.get_supabase_client")
    async def test_list_teams_returns_array(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # Mock teams query
        teams_query = MagicMock()
        teams_query.eq.return_value = teams_query
        teams_query.order.return_value = teams_query
        teams_query.execute.return_value = MagicMock(
            data=[{**MOCK_TEAM_ROW, "people": None}]
        )

        # Mock member count query
        members_query = MagicMock()
        members_query.eq.return_value = members_query
        members_query.execute.return_value = MagicMock(count=5)

        def table_router(name):
            if name == "teams":
                mock_t = MagicMock()
                mock_t.select.return_value = teams_query
                return mock_t
            elif name == "people":
                mock_t = MagicMock()
                mock_t.select.return_value = members_query
                return mock_t
            return MagicMock()

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/teams")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == "Engineering"
        assert data[0]["member_count"] == 5


@pytest.mark.asyncio
class TestUpdateTeam:
    """Tests for PUT /api/v1/teams/{team_id}."""

    @patch("app.services.people.get_supabase_client")
    async def test_update_team(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        updated_row = {**MOCK_TEAM_ROW, "name": "Platform Engineering"}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[updated_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put(
            "/api/v1/teams/team-uuid-1",
            json={"name": "Platform Engineering"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Platform Engineering"


@pytest.mark.asyncio
class TestDeleteTeam:
    """Tests for DELETE /api/v1/teams/{team_id}."""

    @patch("app.services.people.get_supabase_client")
    async def test_delete_team_returns_204(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        delete_query = MagicMock()
        delete_query.eq.return_value = delete_query
        delete_query.execute.return_value = MagicMock(data=[MOCK_TEAM_ROW])

        mock_t = MagicMock()
        mock_t.delete.return_value = delete_query
        mock_client.table.return_value = mock_t

        response = await client.delete("/api/v1/teams/team-uuid-1")
        assert response.status_code == 204
