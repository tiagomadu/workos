"""Tests for task (action item) CRUD endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


MOCK_TASK_ROW = {
    "id": "task-uuid-1",
    "user_id": "test-user-id",
    "meeting_id": None,
    "description": "Draft timeline by Friday",
    "owner_name": "Bob",
    "owner_id": None,
    "owner_status": None,
    "due_date": "2026-03-10",
    "status": "not_started",
    "project_id": None,
    "is_archived": False,
    "created_at": "2026-03-04T12:00:00Z",
    "updated_at": "2026-03-04T12:00:00Z",
}

MOCK_OVERDUE_TASK_ROW = {
    "id": "task-uuid-2",
    "user_id": "test-user-id",
    "meeting_id": None,
    "description": "Overdue task",
    "owner_name": "Alice",
    "owner_id": None,
    "owner_status": None,
    "due_date": "2026-01-01",
    "status": "not_started",
    "project_id": None,
    "is_archived": False,
    "created_at": "2026-01-01T12:00:00Z",
    "updated_at": "2026-01-01T12:00:00Z",
}

MOCK_ARCHIVED_TASK_ROW = {
    "id": "task-uuid-3",
    "user_id": "test-user-id",
    "meeting_id": None,
    "description": "Archived task",
    "owner_name": None,
    "owner_id": None,
    "owner_status": None,
    "due_date": "2026-02-01",
    "status": "complete",
    "project_id": None,
    "is_archived": True,
    "created_at": "2026-02-01T12:00:00Z",
    "updated_at": "2026-02-01T12:00:00Z",
}


def _make_chainable_query(data=None, count=None):
    """Create a MagicMock that supports chaining (eq, neq, in_, order, execute)."""
    query = MagicMock()
    query.eq.return_value = query
    query.neq.return_value = query
    query.in_.return_value = query
    query.order.return_value = query
    query.execute.return_value = MagicMock(data=data or [], count=count)
    return query


@pytest.mark.asyncio
class TestListTasks:
    """Tests for GET /api/v1/tasks."""

    @patch("app.services.tasks.get_supabase_client")
    async def test_list_tasks_returns_array(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # action_items query
        ai_query = _make_chainable_query(data=[MOCK_TASK_ROW.copy()])

        def table_router(name):
            if name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            # projects / meetings for enrichment (empty)
            return MagicMock(
                select=MagicMock(return_value=_make_chainable_query(data=[]))
            )

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/tasks")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["description"] == "Draft timeline by Friday"

    @patch("app.services.tasks.get_supabase_client")
    async def test_list_tasks_with_status_filter(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        ai_query = _make_chainable_query(data=[MOCK_TASK_ROW.copy()])

        def table_router(name):
            if name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            return MagicMock(
                select=MagicMock(return_value=_make_chainable_query(data=[]))
            )

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/tasks?status=not_started")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify the eq filter was applied (user_id + is_archived + status)
        assert ai_query.eq.call_count >= 3

    @patch("app.services.tasks.get_supabase_client")
    async def test_list_tasks_computes_is_overdue(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        ai_query = _make_chainable_query(
            data=[MOCK_TASK_ROW.copy(), MOCK_OVERDUE_TASK_ROW.copy()]
        )

        def table_router(name):
            if name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            return MagicMock(
                select=MagicMock(return_value=_make_chainable_query(data=[]))
            )

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/tasks")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Overdue task should be sorted first
        assert data[0]["id"] == "task-uuid-2"
        assert data[0]["is_overdue"] is True
        assert data[1]["id"] == "task-uuid-1"
        assert data[1]["is_overdue"] is False

    @patch("app.services.tasks.get_supabase_client")
    async def test_archived_tasks_excluded_by_default(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        """When include_archived is False (default), is_archived=False filter is applied."""
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # Return only non-archived tasks (simulating DB filter)
        ai_query = _make_chainable_query(data=[MOCK_TASK_ROW.copy()])

        def table_router(name):
            if name == "action_items":
                mock_t = MagicMock()
                mock_t.select.return_value = ai_query
                return mock_t
            return MagicMock(
                select=MagicMock(return_value=_make_chainable_query(data=[]))
            )

        mock_client.table.side_effect = table_router

        response = await client.get("/api/v1/tasks")

        assert response.status_code == 200
        data = response.json()
        # All returned tasks should not be archived
        for item in data:
            assert item["is_archived"] is False


@pytest.mark.asyncio
class TestCreateTask:
    """Tests for POST /api/v1/tasks."""

    @patch("app.services.tasks.get_supabase_client")
    async def test_create_standalone_task_returns_201(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_table = MagicMock()
        mock_table.insert.return_value.execute.return_value = MagicMock(
            data=[MOCK_TASK_ROW]
        )
        mock_supabase.return_value.table.return_value = mock_table

        response = await client.post(
            "/api/v1/tasks",
            json={"description": "Draft timeline by Friday"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "Draft timeline by Friday"
        assert data["id"] == "task-uuid-1"
        # Should have a due_date (either from input or default)
        assert data["due_date"] is not None

    async def test_create_task_without_description_returns_422(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/api/v1/tasks",
            json={"status": "not_started"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestUpdateTask:
    """Tests for PUT /api/v1/tasks/{task_id}."""

    @patch("app.services.tasks.get_supabase_client")
    async def test_update_task_status(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        updated_row = {**MOCK_TASK_ROW, "status": "in_progress"}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[updated_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put(
            "/api/v1/tasks/task-uuid-1",
            json={"status": "in_progress"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"


@pytest.mark.asyncio
class TestArchiveTask:
    """Tests for PUT /api/v1/tasks/{task_id}/archive and unarchive."""

    @patch("app.services.tasks.get_supabase_client")
    async def test_archive_task_sets_is_archived_true(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        archived_row = {**MOCK_TASK_ROW, "is_archived": True}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[archived_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put("/api/v1/tasks/task-uuid-1/archive")

        assert response.status_code == 200
        data = response.json()
        assert data["is_archived"] is True

    @patch("app.services.tasks.get_supabase_client")
    async def test_unarchive_task(
        self, mock_supabase: MagicMock, client: AsyncClient
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        unarchived_row = {**MOCK_ARCHIVED_TASK_ROW, "is_archived": False}
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[unarchived_row])

        mock_t = MagicMock()
        mock_t.update.return_value = update_query
        mock_client.table.return_value = mock_t

        response = await client.put("/api/v1/tasks/task-uuid-3/unarchive")

        assert response.status_code == 200
        data = response.json()
        assert data["is_archived"] is False
