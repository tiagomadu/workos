"""Tests for people CRUD endpoints."""

from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient


MOCK_PERSON_ROW = {
    "id": "person-uuid-1",
    "user_id": "test-user-id",
    "name": "Alice Smith",
    "role_title": "Engineer",
    "team_id": None,
    "notes": "Ali, A. Smith",
    "created_at": "2026-03-04T12:00:00Z",
    "updated_at": "2026-03-04T12:00:00Z",
}


@pytest.mark.asyncio
class TestCreatePerson:
    """Tests for POST /api/v1/people."""

    @patch("app.services.people.get_supabase_client")
    async def test_create_person_returns_201(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_table = MagicMock()
        mock_table.insert.return_value.execute.return_value = MagicMock(
            data=[MOCK_PERSON_ROW]
        )
        mock_supabase.return_value.table.return_value = mock_table

        response = await client.post(
            "/api/v1/people",
            json={"name": "Alice Smith", "role_title": "Engineer", "aliases": "Ali, A. Smith"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Alice Smith"
        assert data["id"] == "person-uuid-1"
        assert data["aliases"] == "Ali, A. Smith"

    async def test_create_person_without_name_returns_422(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/api/v1/people",
            json={"role_title": "Engineer"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestListPeople:
    """Tests for GET /api/v1/people."""

    @patch("app.services.people.get_supabase_client")
    async def test_list_people_returns_array(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # Mock the people query chain: select -> eq -> or_ -> order -> execute
        people_query = MagicMock()
        people_query.eq.return_value = people_query
        people_query.or_.return_value = people_query
        people_query.order.return_value = people_query
        people_query.execute.return_value = MagicMock(
            data=[{**MOCK_PERSON_ROW, "teams": {"name": "Engineering"}}]
        )

        # Mock the action items count query chain
        ai_query = MagicMock()
        ai_query.eq.return_value = ai_query
        ai_query.execute.return_value = MagicMock(count=3)

        def table_router(name):
            if name == "people":
                mock_t = MagicMock()
                mock_t.select.return_value = people_query
                return mock_t
            elif name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            return MagicMock()

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/people")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == "Alice Smith"
        assert data[0]["team_name"] == "Engineering"
        assert data[0]["action_item_count"] == 3

    @patch("app.services.people.get_supabase_client")
    async def test_list_people_with_search_filter(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        people_query = MagicMock()
        people_query.eq.return_value = people_query
        people_query.or_.return_value = people_query
        people_query.order.return_value = people_query
        people_query.execute.return_value = MagicMock(
            data=[{**MOCK_PERSON_ROW, "teams": None}]
        )

        ai_query = MagicMock()
        ai_query.eq.return_value = ai_query
        ai_query.execute.return_value = MagicMock(count=0)

        def table_router(name):
            if name == "people":
                mock_t = MagicMock()
                mock_t.select.return_value = people_query
                return mock_t
            elif name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            return MagicMock()

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/people?search=Alice")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        # Verify or_ was called (search filter applied)
        people_query.or_.assert_called_once()


@pytest.mark.asyncio
class TestGetPerson:
    """Tests for GET /api/v1/people/{person_id}."""

    @patch("app.services.people.get_supabase_client")
    async def test_get_person_detail_includes_stats(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # Mock the person query
        person_query = MagicMock()
        person_query.eq.return_value = person_query
        person_query.execute.return_value = MagicMock(
            data=[{**MOCK_PERSON_ROW, "teams": {"name": "Engineering"}}]
        )

        # Mock the action items query
        ai_query = MagicMock()
        ai_query.eq.return_value = ai_query
        ai_query.execute.return_value = MagicMock(
            data=[
                {"id": "ai-1", "status": "completed", "due_date": "2026-03-01"},
                {"id": "ai-2", "status": "not_started", "due_date": "2026-02-01"},
                {"id": "ai-3", "status": "not_started", "due_date": "2026-04-01"},
            ]
        )

        def table_router(name):
            if name == "people":
                mock_t = MagicMock()
                mock_t.select.return_value = person_query
                return mock_t
            elif name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            return MagicMock()

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/people/person-uuid-1")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "person-uuid-1"
        assert data["total_items"] == 3
        assert data["completed_items"] == 1
        # overdue: ai-2 is due 2026-02-01 and not completed -> overdue
        assert data["overdue_items"] == 1
        assert data["completion_rate"] == pytest.approx(33.33, abs=1)

    @patch("app.services.people.get_supabase_client")
    async def test_get_person_not_found_returns_404(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        person_query = MagicMock()
        person_query.eq.return_value = person_query
        person_query.execute.return_value = MagicMock(data=[])

        mock_t = MagicMock()
        mock_t.select.return_value = person_query
        mock_client.table.return_value = mock_t

        response = await client.get("/api/v1/people/nonexistent-id")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdatePerson:
    """Tests for PUT /api/v1/people/{person_id}."""

    @patch("app.services.people.get_supabase_client")
    async def test_update_person(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        updated_row = {**MOCK_PERSON_ROW, "name": "Alice Johnson"}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[updated_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put(
            "/api/v1/people/person-uuid-1",
            json={"name": "Alice Johnson"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Alice Johnson"


@pytest.mark.asyncio
class TestDeletePerson:
    """Tests for DELETE /api/v1/people/{person_id}."""

    @patch("app.services.people.get_supabase_client")
    async def test_delete_person_returns_204(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        delete_query = MagicMock()
        delete_query.eq.return_value = delete_query
        delete_query.execute.return_value = MagicMock(data=[MOCK_PERSON_ROW])

        mock_t = MagicMock()
        mock_t.delete.return_value = delete_query
        mock_client.table.return_value = mock_t

        response = await client.delete("/api/v1/people/person-uuid-1")
        assert response.status_code == 204
