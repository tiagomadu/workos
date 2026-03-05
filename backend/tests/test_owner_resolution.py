"""Unit tests for owner resolution service."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.owner_resolution import (
    compute_similarity,
    check_alias_match,
    resolve_owners,
    _resolve_single_owner,
)


class TestComputeSimilarity:
    """Tests for compute_similarity function."""

    def test_identical_names_return_1(self) -> None:
        assert compute_similarity("Alice", "Alice") == 1.0

    def test_case_insensitive(self) -> None:
        assert compute_similarity("Alice", "alice") == 1.0

    def test_whitespace_stripped(self) -> None:
        assert compute_similarity("  Alice  ", "Alice") == 1.0

    def test_different_names_return_low(self) -> None:
        score = compute_similarity("Alice", "Bob")
        assert score < 0.5

    def test_similar_names_return_high(self) -> None:
        score = compute_similarity("Alice Smith", "Alice Smyth")
        assert score > 0.7

    def test_expected_ratios(self) -> None:
        # "Bob" vs "Robert" should be relatively low
        score = compute_similarity("Bob", "Robert")
        assert score < 0.6

        # "Alice Smith" vs "Alice Smith" should be 1.0
        score = compute_similarity("Alice Smith", "Alice Smith")
        assert score == 1.0


class TestCheckAliasMatch:
    """Tests for check_alias_match function."""

    def test_exact_alias_match(self) -> None:
        assert check_alias_match("Ali", "Ali, Alice, A. Smith") is True

    def test_case_insensitive_alias(self) -> None:
        assert check_alias_match("ali", "Ali, Alice") is True

    def test_no_match(self) -> None:
        assert check_alias_match("Bob", "Ali, Alice") is False

    def test_none_aliases_returns_false(self) -> None:
        assert check_alias_match("Alice", None) is False

    def test_empty_aliases_returns_false(self) -> None:
        assert check_alias_match("Alice", "") is False

    def test_comma_separated_aliases(self) -> None:
        aliases = "Al, Alice S, A. Smith"
        assert check_alias_match("Alice S", aliases) is True
        assert check_alias_match("Al", aliases) is True
        assert check_alias_match("A. Smith", aliases) is True
        assert check_alias_match("Bob", aliases) is False

    def test_whitespace_handling(self) -> None:
        assert check_alias_match("Ali", "  Ali  ,  Alice  ") is True


class TestResolveSingleOwner:
    """Tests for _resolve_single_owner (internal function)."""

    def test_exact_name_match_returns_resolved(self) -> None:
        people = [
            {"id": "p1", "name": "Alice Smith", "notes": None},
            {"id": "p2", "name": "Bob Jones", "notes": None},
        ]
        result = _resolve_single_owner("Alice Smith", people)
        assert result["owner_status"] == "resolved"
        assert result["owner_id"] == "p1"
        assert result["confidence"] == 1.0

    def test_alias_match_returns_resolved(self) -> None:
        people = [
            {"id": "p1", "name": "Alice Smith", "notes": "Ali, A. Smith"},
            {"id": "p2", "name": "Bob Jones", "notes": None},
        ]
        result = _resolve_single_owner("Ali", people)
        assert result["owner_status"] == "resolved"
        assert result["owner_id"] == "p1"
        assert result["confidence"] == 0.95

    def test_fuzzy_match_above_threshold_returns_resolved(self) -> None:
        people = [
            {"id": "p1", "name": "Alice Smithson", "notes": None},
            {"id": "p2", "name": "Bob Jones", "notes": None},
        ]
        result = _resolve_single_owner("Alice Smithsn", people)
        assert result["owner_status"] == "resolved"
        assert result["owner_id"] == "p1"
        assert result["confidence"] >= 0.8

    def test_ambiguous_match_returns_ambiguous_with_candidates(self) -> None:
        people = [
            {"id": "p1", "name": "Alice Smith", "notes": None},
            {"id": "p2", "name": "Alice Smith", "notes": None},
        ]
        result = _resolve_single_owner("Alice Smith", people)
        assert result["owner_status"] == "ambiguous"
        assert result["owner_id"] is None
        assert len(result["candidates"]) == 2

    def test_no_match_returns_unresolved(self) -> None:
        people = [
            {"id": "p1", "name": "Alice Smith", "notes": None},
            {"id": "p2", "name": "Bob Jones", "notes": None},
        ]
        result = _resolve_single_owner("Charlie Brown", people)
        assert result["owner_status"] == "unresolved"
        assert result["owner_id"] is None
        assert result["confidence"] == 0.0
        assert len(result["candidates"]) == 0


@pytest.mark.asyncio
class TestResolveOwners:
    """Tests for resolve_owners async function."""

    @patch("app.services.owner_resolution.get_supabase_client")
    async def test_resolve_owners_exact_match(
        self, mock_supabase: MagicMock
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        # action_items query chain
        ai_query = MagicMock()
        ai_query.eq.return_value = ai_query
        ai_query.not_.is_.return_value = ai_query
        ai_query.is_.return_value = ai_query
        ai_query.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ai-1",
                    "owner_name": "Alice Smith",
                    "owner_id": None,
                    "meeting_id": "m1",
                    "user_id": "u1",
                }
            ]
        )

        # people query chain
        people_query = MagicMock()
        people_query.eq.return_value = people_query
        people_query.execute.return_value = MagicMock(
            data=[
                {"id": "p1", "name": "Alice Smith", "notes": None},
                {"id": "p2", "name": "Bob Jones", "notes": None},
            ]
        )

        # update query chain
        update_query = MagicMock()
        update_query.eq.return_value = update_query
        update_query.execute.return_value = MagicMock(data=[{}])

        call_count = {"n": 0}

        def table_router(name):
            mock_t = MagicMock()
            if name == "action_items":
                call_count["n"] += 1
                if call_count["n"] == 1:
                    # First call: select for items to resolve
                    select_q = MagicMock()
                    select_q.eq.return_value = select_q
                    not_mock = MagicMock()
                    not_mock.is_.return_value = select_q
                    select_q.not_ = not_mock
                    select_q.is_.return_value = select_q
                    select_q.execute.return_value = MagicMock(
                        data=[{
                            "id": "ai-1",
                            "owner_name": "Alice Smith",
                            "owner_id": None,
                        }]
                    )
                    mock_t.select.return_value = select_q
                else:
                    # Subsequent calls: update
                    mock_t.update.return_value = update_query
                return mock_t
            elif name == "people":
                mock_t.select.return_value = people_query
                return mock_t
            return mock_t

        mock_client.table.side_effect = table_router

        results = await resolve_owners("m1", "u1")

        assert len(results) == 1
        assert results[0]["owner_status"] == "resolved"
        assert results[0]["owner_id"] == "p1"

    @patch("app.services.owner_resolution.get_supabase_client")
    async def test_resolve_owners_no_items(
        self, mock_supabase: MagicMock
    ) -> None:
        mock_client = MagicMock()
        mock_supabase.return_value = mock_client

        ai_select = MagicMock()
        ai_select.eq.return_value = ai_select
        not_mock = MagicMock()
        not_mock.is_.return_value = ai_select
        ai_select.not_ = not_mock
        ai_select.is_.return_value = ai_select
        ai_select.execute.return_value = MagicMock(data=[])

        mock_t = MagicMock()
        mock_t.select.return_value = ai_select
        mock_client.table.return_value = mock_t

        results = await resolve_owners("m1", "u1")
        assert results == []
