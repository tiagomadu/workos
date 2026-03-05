# Phase 3: Intelligence Layer - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add RAG-based semantic search across all meeting content. Users type natural language questions and receive AI-generated answers with source citations, drawn from embedded meeting summaries and transcripts. Embeddings use nomic-embed-text (768-dim, always local via Ollama) for consistency regardless of active LLM provider.

Covers: SEARCH-01–07

</domain>

<decisions>
## Implementation Decisions

### Search UI
- **Dedicated search page**: Full page at /search with search bar at top, filter chips (date range, meeting type), and results area below. Clean, focused experience. No global search bar — keeps nav simple.

### Results Display
- **AI answer + source cards**: Top of results shows an AI-generated answer paragraph synthesized from relevant chunks. Below: source citation cards showing meeting title, date, and the relevant excerpt that contributed to the answer. Each card links to the source meeting.

### Index Scope
- **Summaries + transcripts**: Embed both AI-generated summary sections (overview, key topics, decisions, follow-ups) AND the raw transcript text. Summary chunks provide concise, structured answers. Transcript chunks provide granular, verbatim detail. Different chunk strategies for each:
  - Summary: one chunk per section (overview, topics, decisions, follow-ups)
  - Transcript: sliding window chunks (~500 tokens, 50 token overlap)

### Indexing Trigger
- **Auto after processing**: Generate embeddings as the 5th pipeline step after owner resolution. Flow becomes: detect type → summarize → extract actions → resolve owners → generate embeddings → completed. Embeddings available immediately for search.

### Claude's Discretion
- Chunk size and overlap tuning for transcript text
- nomic-embed-text model configuration and batch size
- Search result ranking and similarity threshold
- Answer generation prompt design
- Filter implementation (date range picker, meeting type chips)
- Error handling for embedding generation failures

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- document_embeddings table with 768-dim vector column (Phase 1 migration)
- HNSW index on embeddings (Phase 1 migration)
- match_documents() PostgreSQL function with cosine similarity (Phase 1 migration)
- LLM Provider Protocol and factory (Phase 1 — for answer generation)
- Jinja2 prompt renderer (Phase 1 — for search answer prompt)
- Processing pipeline with sequential steps (Phase 1, extended in Phase 2)
- React Query patterns (Phase 1/2)

### Integration Points
- Processing pipeline (backend/app/services/processing.py) gains 5th step: generate_embeddings
- New Jinja2 prompt template for answer generation with context
- Frontend needs new /search route with search bar and results
- Ollama must have nomic-embed-text model pulled for local embedding generation

</code_context>

<specifics>
## Specific Ideas

- nomic-embed-text always runs through Ollama (even when LLM_PROVIDER=claude) for embedding consistency
- Answer generation uses the active LLM provider (Ollama or Claude) — only embeddings are always local
- Source cards should show meeting title, date, meeting type, and a 2-3 sentence excerpt
- Date range filter uses two date inputs (from/to)
- Meeting type filter uses chips matching the existing meeting types

</specifics>

<deferred>
## Deferred Ideas

- Cross-meeting project intelligence (synthesized project summaries) — deferred to v2
- Scoped search (filter by project) — deferred to v2
- Relevance scoring display — deferred to v2

</deferred>

---

*Phase: 03-intelligence-rag*
*Context gathered: 2026-03-04*
