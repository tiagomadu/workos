"""RAG search service: vector search + AI answer generation."""

import logging
from typing import Optional

from app.core.supabase import get_supabase_client
from app.services.embeddings import get_embedding
from app.ai.prompt_renderer import render_prompt
from app.ai.schemas import SearchAnswer
from app.ai.factory import create_llm_provider

logger = logging.getLogger(__name__)


async def search_meetings(
    query: str,
    user_id: str,
    date_from: str = None,
    date_to: str = None,
    meeting_type: str = None,
    limit: int = 10,
) -> dict:
    """Search meetings using RAG: embed query -> vector search -> LLM answer."""
    supabase = get_supabase_client()

    # Step 1: Embed the query
    query_embedding = await get_embedding(query)
    if query_embedding is None:
        return {
            "answer": "Search is currently unavailable. Please ensure Ollama is running with nomic-embed-text.",
            "sources": [],
        }

    # Step 2: Vector similarity search via match_documents RPC
    embedding_str = str(query_embedding)
    search_result = supabase.rpc("match_documents", {
        "query_embedding": embedding_str,
        "match_threshold": 0.7,
        "match_count": limit,
        "filter_user_id": user_id,
    }).execute()

    matches = search_result.data or []

    if not matches:
        return {"answer": "No relevant meetings found for your query.", "sources": []}

    # Step 3: Enrich with meeting metadata
    meeting_ids = list(set(m["meeting_id"] for m in matches))
    meetings_result = (
        supabase.table("meetings")
        .select("id, title, meeting_date, meeting_type")
        .in_("id", meeting_ids)
        .execute()
    )

    meeting_map = {}
    for m in meetings_result.data or []:
        meeting_map[m["id"]] = m

    enriched = []
    for match in matches:
        meeting = meeting_map.get(match["meeting_id"], {})
        enriched.append({
            "meeting_id": match["meeting_id"],
            "meeting_title": meeting.get("title"),
            "meeting_date": meeting.get("meeting_date"),
            "meeting_type": meeting.get("meeting_type"),
            "chunk_text": match["chunk_text"],
            "similarity": match["similarity"],
        })

    # Step 4: Apply post-filters
    if date_from:
        enriched = [
            s for s in enriched
            if s.get("meeting_date") and s["meeting_date"] >= date_from
        ]
    if date_to:
        enriched = [
            s for s in enriched
            if s.get("meeting_date") and s["meeting_date"] <= date_to
        ]
    if meeting_type:
        enriched = [
            s for s in enriched
            if s.get("meeting_type") == meeting_type
        ]

    if not enriched:
        return {"answer": "No matching meetings found for your filters.", "sources": []}

    # Step 5: Generate AI answer using top chunks
    top_chunks = enriched[:5]
    prompt = render_prompt("generate_answer.j2", question=query, chunks=top_chunks)

    try:
        provider = create_llm_provider()
        result = await provider.generate_structured(
            messages=[{"role": "user", "content": prompt}],
            response_model=SearchAnswer,
        )
        answer = result.answer
    except Exception as e:
        logger.error(f"Answer generation failed: {e}")
        answer = "I found relevant meetings but couldn't generate a summary. See the sources below."

    return {"answer": answer, "sources": enriched}
