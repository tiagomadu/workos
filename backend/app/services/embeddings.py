"""Embedding generation service using nomic-embed-text via Ollama."""

import logging
from typing import Optional

import httpx

from app.core.config import settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


async def get_embedding(text: str, ollama_url: str = None) -> Optional[list[float]]:
    """Generate embedding using nomic-embed-text via Ollama API."""
    url = (ollama_url or settings.OLLAMA_BASE_URL).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{url}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding")
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return None


def chunk_summary(summary: dict, meeting_id: str) -> list[dict]:
    """Create chunks from meeting summary sections."""
    chunks = []
    idx = 0

    if summary.get("overview"):
        chunks.append({
            "chunk_text": f"Meeting Overview: {summary['overview']}",
            "chunk_index": idx,
            "metadata": {"section": "overview", "meeting_id": meeting_id},
        })
        idx += 1

    if summary.get("key_topics"):
        topics = summary["key_topics"]
        if isinstance(topics, list):
            topics = ", ".join(topics)
        chunks.append({
            "chunk_text": f"Key Topics Discussed: {topics}",
            "chunk_index": idx,
            "metadata": {"section": "key_topics", "meeting_id": meeting_id},
        })
        idx += 1

    if summary.get("decisions"):
        decisions = summary["decisions"]
        if isinstance(decisions, list):
            decisions = "; ".join(decisions)
        chunks.append({
            "chunk_text": f"Decisions Made: {decisions}",
            "chunk_index": idx,
            "metadata": {"section": "decisions", "meeting_id": meeting_id},
        })
        idx += 1

    if summary.get("follow_ups"):
        follow_ups = summary["follow_ups"]
        if isinstance(follow_ups, list):
            follow_ups = "; ".join(follow_ups)
        chunks.append({
            "chunk_text": f"Follow-ups: {follow_ups}",
            "chunk_index": idx,
            "metadata": {"section": "follow_ups", "meeting_id": meeting_id},
        })
        idx += 1

    return chunks


def chunk_transcript(
    transcript: str,
    meeting_id: str,
    chunk_size: int = 500,
    overlap: int = 50,
    start_index: int = 4,
) -> list[dict]:
    """Create sliding window chunks from transcript text."""
    if not transcript or not transcript.strip():
        return []

    words = transcript.split()
    chunks = []
    idx = start_index
    start = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)

        chunks.append({
            "chunk_text": chunk_text,
            "chunk_index": idx,
            "metadata": {"type": "transcript", "meeting_id": meeting_id},
        })
        idx += 1

        if end >= len(words):
            break
        start = end - overlap

    return chunks


async def generate_embeddings(meeting_id: str, user_id: str) -> int:
    """Generate and store embeddings for a meeting's content."""
    supabase = get_supabase_client()

    # Fetch meeting record
    result = (
        supabase.table("meetings")
        .select("*")
        .eq("id", meeting_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        logger.error(f"Meeting {meeting_id} not found")
        return 0

    meeting = result.data[0]
    summary = meeting.get("summary") or {}
    transcript = meeting.get("raw_transcript") or ""

    # Delete existing embeddings for reprocessing support
    supabase.table("document_embeddings").delete().eq("meeting_id", meeting_id).execute()

    # Create chunks
    all_chunks = []
    all_chunks.extend(chunk_summary(summary, meeting_id))
    start_idx = len(all_chunks)
    all_chunks.extend(chunk_transcript(transcript, meeting_id, start_index=start_idx))

    if not all_chunks:
        logger.warning(f"No chunks to embed for meeting {meeting_id}")
        return 0

    # Generate embeddings and insert
    count = 0
    for chunk in all_chunks:
        embedding = await get_embedding(chunk["chunk_text"])
        if embedding is None:
            logger.warning(f"Skipping chunk {chunk['chunk_index']} - embedding failed")
            continue

        # pgvector expects embedding as a string like "[0.1, 0.2, ...]"
        embedding_str = str(embedding)
        supabase.table("document_embeddings").insert({
            "user_id": user_id,
            "meeting_id": meeting_id,
            "chunk_index": chunk["chunk_index"],
            "chunk_text": chunk["chunk_text"],
            "embedding": embedding_str,
            "metadata": chunk.get("metadata", {}),
        }).execute()
        count += 1

    logger.info(f"Generated {count} embeddings for meeting {meeting_id}")
    return count
