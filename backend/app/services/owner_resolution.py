"""Owner resolution service for matching action item owners to people records."""

import logging
from difflib import SequenceMatcher

from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


def compute_similarity(name1: str, name2: str) -> float:
    """Compute similarity ratio between two names using SequenceMatcher.

    Returns a float between 0.0 and 1.0.
    """
    return SequenceMatcher(
        None,
        name1.lower().strip(),
        name2.lower().strip(),
    ).ratio()


def check_alias_match(owner_name: str, aliases_text: str | None) -> bool:
    """Check if owner_name matches any comma-separated alias in aliases_text.

    Comparison is case-insensitive and strips whitespace.
    """
    if not aliases_text:
        return False

    owner_lower = owner_name.lower().strip()
    for alias in aliases_text.split(","):
        if alias.strip().lower() == owner_lower:
            return True
    return False


async def resolve_owners(meeting_id: str, user_id: str) -> list[dict]:
    """Resolve action item owners to people records for a given meeting.

    For each unresolved action item (has owner_name but no owner_id):
    1. Try exact name match
    2. Try alias match (notes field)
    3. Try fuzzy match (threshold >= 0.8)

    Returns a list of resolution results for each processed action item.
    """
    supabase = get_supabase_client()

    # Fetch action items that need resolution
    items_result = (
        supabase.table("action_items")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("user_id", user_id)
        .not_.is_("owner_name", "null")
        .is_("owner_id", "null")
        .execute()
    )
    action_items = items_result.data

    if not action_items:
        return []

    # Fetch all people for this user
    people_result = (
        supabase.table("people")
        .select("id, name, notes")
        .eq("user_id", user_id)
        .execute()
    )
    people = people_result.data

    results = []

    for item in action_items:
        owner_name = item["owner_name"]
        resolution = _resolve_single_owner(owner_name, people)

        # Update action item in DB
        update_data = {
            "owner_status": resolution["owner_status"],
        }
        if resolution["owner_id"]:
            update_data["owner_id"] = resolution["owner_id"]

        supabase.table("action_items").update(update_data).eq("id", item["id"]).execute()

        resolution["action_item_id"] = item["id"]
        results.append(resolution)

    return results


def _resolve_single_owner(owner_name: str, people: list[dict]) -> dict:
    """Resolve a single owner name against a list of people.

    Returns a dict with owner_name, owner_id, owner_status, candidates, confidence.
    """
    FUZZY_THRESHOLD = 0.8

    # Step 1: Exact match
    exact_matches = [
        p for p in people
        if p["name"].lower().strip() == owner_name.lower().strip()
    ]
    if len(exact_matches) == 1:
        return {
            "owner_name": owner_name,
            "owner_id": exact_matches[0]["id"],
            "owner_status": "resolved",
            "candidates": [],
            "confidence": 1.0,
        }
    if len(exact_matches) > 1:
        return {
            "owner_name": owner_name,
            "owner_id": None,
            "owner_status": "ambiguous",
            "candidates": [{"id": p["id"], "name": p["name"]} for p in exact_matches],
            "confidence": 1.0,
        }

    # Step 2: Alias match
    alias_matches = [
        p for p in people
        if check_alias_match(owner_name, p.get("notes"))
    ]
    if len(alias_matches) == 1:
        return {
            "owner_name": owner_name,
            "owner_id": alias_matches[0]["id"],
            "owner_status": "resolved",
            "candidates": [],
            "confidence": 0.95,
        }
    if len(alias_matches) > 1:
        return {
            "owner_name": owner_name,
            "owner_id": None,
            "owner_status": "ambiguous",
            "candidates": [{"id": p["id"], "name": p["name"]} for p in alias_matches],
            "confidence": 0.95,
        }

    # Step 3: Fuzzy match
    scored = []
    for p in people:
        sim = compute_similarity(owner_name, p["name"])
        if sim >= FUZZY_THRESHOLD:
            scored.append({"id": p["id"], "name": p["name"], "score": sim})

    # Also check fuzzy against aliases
    for p in people:
        if p.get("notes"):
            for alias in p["notes"].split(","):
                alias = alias.strip()
                if alias:
                    sim = compute_similarity(owner_name, alias)
                    if sim >= FUZZY_THRESHOLD:
                        # Avoid duplicates
                        if not any(s["id"] == p["id"] for s in scored):
                            scored.append({"id": p["id"], "name": p["name"], "score": sim})

    scored.sort(key=lambda x: x["score"], reverse=True)

    if len(scored) == 1:
        return {
            "owner_name": owner_name,
            "owner_id": scored[0]["id"],
            "owner_status": "resolved",
            "candidates": [],
            "confidence": scored[0]["score"],
        }
    if len(scored) > 1:
        return {
            "owner_name": owner_name,
            "owner_id": None,
            "owner_status": "ambiguous",
            "candidates": [{"id": s["id"], "name": s["name"]} for s in scored],
            "confidence": scored[0]["score"],
        }

    # No match
    return {
        "owner_name": owner_name,
        "owner_id": None,
        "owner_status": "unresolved",
        "candidates": [],
        "confidence": 0.0,
    }
