"""Tests for project CRUD endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


MOCK_PROJECT_ROW = {
    "id": "project-uuid-1",
    "user_id": "test-user-id",
    "name": "Q4 Planning",
    "description": "Plan for Q4 initiatives",
    "status": "on_track",
    "team_id": None,
    "created_at": "2026-03-04T12:00:00Z",
    "updated_at": "2026-03-04T12:00:00Z",
}

MOCK_ARCHIVED_PROJECT_ROW = {
    "id": "project-uuid-2",
    "user_id": "test-user-id",
    "name": "Old Project",
    "description": "Archived project",
    "status": "archived",
    "team_id": None,
    "created_at": "2026-01-01T12:00:00Z",
    "updated_at": "2026-01-01T12:00:00Z",
}


def _make_chainable_query(data=None, count=None):
    """Create a MagicMock that supports chaining."""
    query = MagicMock()
    query.eq.return_value = query
    query.neq.return_value = query
    query.in_.return_value = query
    query.order.return_value = query
    query.execute.return_value = MagicMock(data=data or [], count=count)
    return query


@pytest.mark.asyncio
class TestCreateProject:
    """Tests for POST /api/v1/projects."""

    @patch("app.services.projects.get_supabase_client")
    async def test_create_project_returns_201(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_table = MagicMock()
        mock_table.insert.return_value.execute.return_value = MagicMock(
            data=[MOCK_PROJECT_ROW]
        )
        mock_supabase.return_value.table.return_value = mock_table

        response = await client.post(
            "/api/v1/projects",
            json={"name": "Q4 Planning", "description": "Plan for Q4 initiatives"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Q4 Planning"
        assert data["id"] == "project-uuid-1"
        assert data["status"] == "on_track"

    async def test_create_project_without_name_returns_422(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/api/v1/projects",
            json={"description": "Missing name"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestListProjects:
    """Tests for GET /api/v1/projects."""

    @patch("app.services.projects.get_supabase_client")
    async def test_list_projects_excludes_archived_by_default(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # Only non-archived projects returned
        proj_query = _make_chainable_query(
            data=[{**MOCK_PROJECT_ROW, "teams": None}]
        )

        mock_t = MagicMock()
        mock_t.select.return_value = proj_query
        mock_client.table.return_value = mock_t

        response = await client.get("/api/v1/projects")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == "Q4 Planning"
        # Verify neq filter was applied for archived exclusion
        proj_query.neq.assert_called_once_with("status", "archived")


@pytest.mark.asyncio
class TestGetProjectDetail:
    """Tests for GET /api/v1/projects/{project_id}."""

    @patch("app.services.projects.get_supabase_client")
    async def test_get_project_detail_includes_stats(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # Project query
        proj_query = _make_chainable_query(
            data=[{**MOCK_PROJECT_ROW, "teams": {"name": "Engineering"}}]
        )

        # Meetings query
        meetings_query = _make_chainable_query(data=[
            {"id": "meet-1", "title": "Sprint Review", "meeting_date": "2026-03-01", "status": "ready"},
            {"id": "meet-2", "title": "Kickoff", "meeting_date": "2026-02-15", "status": "ready"},
        ])

        # Tasks query
        tasks_query = _make_chainable_query(data=[
            {"id": "ai-1", "status": "complete", "due_date": "2026-02-28"},
            {"id": "ai-2", "status": "not_started", "due_date": "2026-01-15"},  # overdue
            {"id": "ai-3", "status": "in_progress", "due_date": "2026-04-01"},
        ])

        def table_router(name):
            if name == "projects":
                mock_t = MagicMock()
                mock_t.select.return_value = proj_query
                return mock_t
            elif name == "meetings":
                mock_t = MagicMock()
                mock_t.select.return_value = meetings_query
                return mock_t
            elif name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = tasks_query
                return mock_t
            return MagicMock()

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/projects/project-uuid-1")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "project-uuid-1"
        assert data["name"] == "Q4 Planning"
        assert data["team_name"] == "Engineering"
        assert data["meeting_count"] == 2
        assert data["total_tasks"] == 3
        assert data["completed_tasks"] == 1
        assert data["overdue_tasks"] == 1
        assert len(data["meetings"]) == 2

    @patch("app.services.projects.get_supabase_client")
    async def test_get_project_not_found_returns_404(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        proj_query = _make_chainable_query(data=[])

        mock_t = MagicMock()
        mock_t.select.return_value = proj_query
        mock_client.table.return_value = mock_t

        response = await client.get("/api/v1/projects/nonexistent-id")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateProject:
    """Tests for PUT /api/v1/projects/{project_id}."""

    @patch("app.services.projects.get_supabase_client")
    async def test_update_project(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        updated_row = {**MOCK_PROJECT_ROW, "name": "Q4 Planning Updated"}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[updated_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put(
            "/api/v1/projects/project-uuid-1",
            json={"name": "Q4 Planning Updated"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Q4 Planning Updated"


@pytest.mark.asyncio
class TestArchiveProject:
    """Tests for PUT /api/v1/projects/{project_id}/archive."""

    @patch("app.services.projects.get_supabase_client")
    async def test_archive_project_sets_status_to_archived(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        archived_row = {**MOCK_PROJECT_ROW, "status": "archived"}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[archived_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put("/api/v1/projects/project-uuid-1/archive")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "archived"
