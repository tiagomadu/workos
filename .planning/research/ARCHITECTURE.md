# Architecture Research

**Project:** WorkOS — AI-Powered Work Management System
**Stack:** Next.js 14 App Router + FastAPI + Supabase (PostgreSQL + pgvector) + Ollama/Claude + LlamaIndex
**Date:** 2026-03-04
**Purpose:** Inform implementation decisions before Sprint 1 begins.

---

## Component Boundaries

A well-structured AI work management system divides responsibility across four layers, each with a clearly scoped domain. The boundaries below reflect what WorkOS's existing Technical Architecture specifies, validated against common patterns in production AI systems.

### 1. Frontend — Next.js App Router

**Owns:** Rendering, routing, user interaction, session management, display of AI-generated content.

**Does not own:** Business logic, AI provider calls, data transformations, or anything requiring Python libraries.

Key responsibilities in this project:
- Auth flows (Google OAuth redirect, session cookie via `@supabase/ssr`)
- All page layouts and navigation (sidebar-driven `(dashboard)/` route group)
- Data fetching via Server Components (initial page loads) and TanStack Query (client-side updates)
- Display of AI-generated output — summaries, extracted tasks, search results — received from FastAPI as structured JSON
- File upload form that sends `.txt` transcript to FastAPI, not directly to Supabase Storage
- No direct calls to Ollama or Anthropic — those live entirely in the backend

The App Router pattern matters here: Server Components handle authenticated data fetching at the page level, while Client Components handle interactivity (file upload widget, task status toggle, search input). This means most pages can render with a single server-side fetch rather than a waterfall of client-side API calls.

### 2. Backend API — FastAPI

**Owns:** All business logic, AI orchestration, data access, third-party API integrations, file handling.

The Router → Service → Model pattern is the standard for FastAPI at this scale:

- **Routers** handle HTTP mechanics only: parse request, call service, return response. No logic.
- **Services** contain all business logic: meeting processing pipeline, task creation, aggregation queries.
- **Models** define data shapes: SQLAlchemy ORM models for database tables, Pydantic schemas for API contracts.
- **AI layer** (`app/ai/`) is its own sub-domain: provider abstraction, prompt management, structured output handling.
- **RAG layer** (`app/rag/`) is another sub-domain: ingestion pipeline, retrieval, context assembly.

FastAPI's `Depends()` system is the right mechanism to inject the active LLM provider, database sessions, and authenticated user context into any endpoint that needs them. This keeps business logic testable without needing a running LLM or real database.

Background task processing: For AI summarization (which can take up to 2 minutes with Ollama), the endpoint should accept the transcript, store it, return a 202 Accepted with a job ID, and execute the AI pipeline using FastAPI's built-in `BackgroundTasks`. The frontend polls `GET /meetings/{id}` until `processed_at` is set. This prevents HTTP timeout and gives the user immediate feedback. Celery/ARQ are overkill for a single-user tool.

### 3. Data Platform — Supabase

**Owns:** Persistent storage across four capabilities from one platform:
- **PostgreSQL** — all relational data (9 tables defined in the Technical Architecture)
- **pgvector** — vector embeddings for semantic search (`document_embeddings` table, 768 dimensions, HNSW index)
- **Supabase Auth** — Google OAuth session management, JWT issuance
- **Supabase Storage** — raw transcript `.txt` files (private bucket, signed URL access)

The critical architectural insight here is that unifying all four capabilities on Supabase eliminates the inter-service complexity of managing ChromaDB + S3 + a separate auth system separately. Row Level Security (RLS) enforces data access at the database level — even if the FastAPI application layer has a bug, unauthorized access is blocked.

The `document_embeddings` table with an HNSW index (`m=16, ef_construction=64`) is suitable for a single-user system with thousands of meeting chunks. HNSW provides approximate nearest neighbor search with significantly better query performance than exact cosine search at scale. The `match_documents()` PostgreSQL function encapsulates the vector search query so FastAPI calls a stored procedure rather than constructing raw vector SQL.

### 4. AI/LLM Services

**Owns:** Text generation, structured output extraction, embedding generation.

Two providers, one interface:
- **Ollama + Llama 3 8B** — local, private, zero network calls, slower (up to 2 min for summarization on Apple Silicon)
- **Claude API (Anthropic)** — cloud, higher quality, faster (under 30 sec), requires API key and internet

The provider abstraction (Python `Protocol`) means the rest of the system is unaware of which provider is active. The factory reads `LLM_PROVIDER` from environment and returns the appropriate implementation. This is a standard dependency inversion pattern.

LlamaIndex wraps the embedding and retrieval complexity. It handles chunking, embedding calls to whichever embedding model is configured, and construction of the retrieval query engine. FastAPI calls LlamaIndex; LlamaIndex calls Ollama or the embedding API.

---

## Data Flow

### Primary Flow: Transcript to Stored Meeting

```
1. Manager uploads .txt file via Next.js upload form
   └── POST /api/v1/meetings/upload-transcript (multipart/form-data)

2. FastAPI validates file (.txt, <= 500KB)
   └── Rejects invalid files immediately with 422

3. FastAPI uploads raw transcript to Supabase Storage
   └── Path: transcripts/{user_id}/{YYYY}/{MM}/{YYYY-MM-DD}_{slug}.txt
   └── Returns signed URL for later retrieval

4. FastAPI creates meetings row in PostgreSQL (status: unprocessed)
   └── Returns meeting ID to frontend with 202 Accepted

5. FastAPI triggers background task: AI processing pipeline
   └── Reads transcript text from Storage
   └── Calls AI agent: detect_meeting_type → summarize → extract_action_items
   └── All three operations are sequential (each output informs the next prompt)

6. AI agent calls LLM provider (Ollama or Claude)
   └── Jinja2 templates render prompts with transcript, date, attendees
   └── Structured output enforced via Pydantic model + instructor library
   └── Returns: MeetingSummaryOutput + list[ExtractedActionItem] + MeetingType

7. FastAPI writes AI output back to PostgreSQL
   └── meetings.summary = JSONB structured summary
   └── meetings.meeting_type = detected type
   └── meetings.processed_at = now()
   └── INSERT INTO tasks for each extracted action item

8. FastAPI triggers RAG ingestion (background, after step 7)
   └── Chunk transcript and summary text (SentenceSplitter, chunk_size=512, overlap=50)
   └── Generate embeddings (nomic-embed-text via Ollama, 768 dims)
   └── INSERT INTO document_embeddings with source_type, source_id, metadata

9. Frontend polls GET /meetings/{id} until processed_at is populated
   └── Displays structured summary and extracted tasks for user review

10. Manager reviews, edits, and confirms
    └── PATCH /meetings/{id} with any summary edits
    └── Confirmed tasks already exist in tasks table; user may add/remove/reassign
```

### Secondary Flow: RAG Search

```
1. Manager types natural language query in search UI
   └── POST /api/v1/search { query, top_k=5, optional date filters }

2. FastAPI embeds the query using the same embedding model (768 dims)

3. FastAPI calls match_documents() PostgreSQL function
   └── HNSW approximate nearest neighbor search against document_embeddings
   └── Returns top_k chunks with similarity scores and metadata

4. FastAPI assembles context: chunk text + source meeting title + date

5. FastAPI renders rag_answer.j2 prompt template with context + query

6. FastAPI calls LLM provider for answer generation

7. FastAPI returns SearchResult { answer, sources: [{ meeting_title, date, chunk, score }] }

8. Frontend renders answer with clickable source citations
```

### Supporting Flows

**Google Calendar Sync:**
User triggers sync → FastAPI fetches events from Google Calendar API using stored OAuth tokens → upserts into `calendar_events` table → frontend displays events.

**Gmail Import:**
User selects email → FastAPI fetches message body from Gmail API → stores as transcript → enters standard transcript processing flow from step 2 above.

**Dashboard Aggregation:**
Single `GET /dashboard/weekly` endpoint → FastAPI runs 4-5 PostgreSQL aggregate queries (meetings this week, open tasks, overdue tasks, project statuses, upcoming events) → assembles into `WeeklyDashboard` response → frontend renders. No AI involved.

---

## AI/LLM Architecture Patterns

### Provider Abstraction via Protocol

The standard pattern for supporting multiple LLM providers without coupling business logic to any specific one is a structural interface (Python `Protocol` or ABC) that defines `generate()`, `generate_structured()`, and `health_check()`. Concrete implementations (OllamaProvider, ClaudeProvider) fulfill the interface independently.

The factory pattern (`create_llm_provider(settings)`) reads configuration and returns the correct implementation. FastAPI injects this at startup via `Depends()` — every endpoint that needs the LLM gets the currently configured provider without knowing what it is.

The key constraint: **both providers must be initialized with the same interface.** If Claude returns structured JSON natively via tool_use and Ollama requires parsing, that difference must be handled inside each provider's `generate_structured()` method — not in the caller. The `instructor` library (wrapping both Anthropic and OpenAI-compatible clients) provides a unified way to enforce Pydantic output schemas across providers.

### Structured Output

The critical reliability problem with AI extraction is hallucinated or malformed output. For production use, structured output requires three layers:

1. **Prompt-level constraint:** The Jinja2 template ends with "Respond ONLY with valid JSON matching this schema." Include a concrete example in the prompt — models follow examples more reliably than schema descriptions alone.

2. **Schema enforcement:** `instructor` library wraps the LLM client and enforces a Pydantic model on the response. It handles retry on parse failure automatically. For Ollama (which doesn't have native tool_use), `instructor` uses the OpenAI-compatible endpoint with JSON mode enabled.

3. **Validation layer:** Pydantic models validate the parsed output before it reaches the service layer. Fields with `| None` types handle cases where the model omits optional fields (e.g., `due_date` on a task where none was mentioned).

For meeting summarization, the `MeetingSummaryOutput` Pydantic model is the contract. For task extraction, `list[ExtractedActionItem]` is the contract. The AI layer returns these typed objects; the service layer writes them to the database.

### Prompt Management via Jinja2 Templates

Jinja2 templates in `backend/app/ai/prompts/` serve three purposes:

1. **Version control:** Prompts are reviewable in pull requests, not buried in Python strings.
2. **Contextual injection:** Templates receive variables (`{{ transcript }}`, `{{ attendees | join(', ') }}`, `{{ meeting_date }}`) at render time. Conditional blocks (`{% if meeting_type %}`) handle optional context gracefully.
3. **Swappability:** Improving a prompt requires editing a `.j2` file, not modifying Python code.

Each task has its own template: `summarize_meeting.j2`, `extract_action_items.j2`, `detect_meeting_type.j2`, `rag_answer.j2`. These are separate rather than combined because: (a) each has different output schemas, (b) separate prompts allow independent quality tuning, and (c) the agent runs them sequentially, passing outputs forward.

The system prompt (role and behavior instructions) is separate from the user prompt (task + data). Both are passed to the provider independently. This maps correctly to both Ollama's `messages` array format and Anthropic's `system` parameter.

### RAG Pipeline Patterns

The standard RAG pipeline has two phases — ingestion and retrieval — and they should be decoupled:

**Ingestion** runs after a meeting is saved. It is a background task, not on the critical path of the upload response. The pipeline: raw text → SentenceSplitter (chunk_size=512, overlap=50) → embedding model → pgvector INSERT. LlamaIndex's `SentenceSplitter` respects sentence boundaries, producing semantically coherent chunks rather than arbitrary character slices. The 50-token overlap ensures context is not lost at chunk boundaries.

Metadata stored alongside each embedding matters enormously for filtering and citation: `source_type` (meeting_summary vs transcript), `source_id` (UUID of the source meeting), `meeting_date`, `meeting_type`. This metadata enables date-range filtering without re-querying the source tables.

**Retrieval** uses approximate nearest neighbor search via the HNSW index on `document_embeddings`. The `match_documents()` PostgreSQL function takes the query embedding and returns top-k chunks by cosine similarity. The HNSW parameters (`m=16, ef_construction=64`) in the Technical Architecture are conservative and correct for a dataset of thousands (not millions) of chunks — they provide fast queries with high recall.

After retrieval, context assembly is where answer quality is determined. The pattern is: sort retrieved chunks by similarity score descending, truncate to fit within the LLM context window (Llama 3 8B has 8K tokens; Claude Sonnet has 200K), and prepend source attribution to each chunk so the LLM can cite sources in its answer.

The `rag_answer.j2` prompt template structures the final call: system prompt establishes the role ("You are an assistant helping an operations manager find information from past meetings"), the context block contains retrieved chunks with source labels, and the user prompt is the original question.

**Embedding dimension consistency (768 dims)** is an explicit architectural decision. `nomic-embed-text` (local) and `text-embedding-3-small` with `dimensions=768` (cloud) produce vectors in the same space, making them interchangeable without re-indexing. This is only valid if you use one or the other consistently — mixing embeddings from different models in the same vector store produces meaningless similarity scores.

### AI Agent Pattern

The `WorkOSAgent` class in `agent.py` is a sequential orchestrator, not a fully autonomous agent. For this use case (meeting processing), sequential is correct: detect type → summarize → extract tasks. Each step receives the output of the previous step as context, improving accuracy (e.g., knowing the meeting is a 1:1 informs the summarization prompt to look for career development topics).

The tool definitions (search_meetings, get_person_tasks, etc.) are intended for the optional chat endpoint (`POST /ai/chat`), not the meeting processing pipeline. The processing pipeline is deterministic; the chat endpoint is where the agent pattern applies — the LLM decides which tools to call to answer a free-form question.

---

## Suggested Build Order

The dependency graph determines the correct build order. Each sprint in the backlog already respects this, but the technical reasons are worth making explicit.

### Phase 1 — Infrastructure (Sprint 0)

Build first because everything else depends on it:

1. **Database schema** — all application code assumes these tables exist. Cannot build services without them.
2. **FastAPI skeleton** — routers, services, config, health endpoint. Establishes the patterns all future code follows.
3. **Supabase Auth + JWT middleware** — every subsequent endpoint needs authentication. Build it once, use everywhere.
4. **LLM provider abstraction** — the AI layer needs this contract before any AI feature can be built.
5. **Next.js scaffold + auth flow** — frontend needs the auth foundation before any page can be protected.
6. **Docker Compose** — enables reproducible development. Do not defer this; it catches environment issues early.

### Phase 2 — Core AI Pipeline (Sprint 1)

Build next because it validates the central value proposition and the hardest technical risks:

1. **File upload to Supabase Storage** — verifies storage integration before building more complex features.
2. **AI summarization (single prompt, one provider)** — get the pipeline working end-to-end with Ollama first. Do not build provider switching until the happy path works.
3. **Meeting save to PostgreSQL** — the service layer pattern gets established here; subsequent features follow the same shape.
4. **Meeting list and detail pages** — the frontend pattern for Server Components + data display gets established.

Do not build RAG indexing yet. Confirm the AI generation pipeline works first, then layer in the embedding pipeline in Sprint 4.

### Phase 3 — Task Extraction + Tracker (Sprint 2)

Depends on Sprint 1's meeting model and AI pipeline:

1. **Action item extraction** — extends the AI pipeline with a second prompt. Reuses provider abstraction.
2. **Tasks CRUD** — straightforward once the table exists and the router/service pattern is established.
3. **Task tracker UI** — data table with filters. Reuses UI patterns from meeting list.

### Phase 4 — People, Teams, Meeting Type (Sprint 3)

Depends on meetings and tasks existing:

1. **People and teams CRUD** — entity management. No AI involved. Establishes relational links used by tasks and meetings.
2. **Meeting type detection** — third AI prompt in the pipeline. Slot it in before the summarization step.
3. **Person profile page** — joins people → tasks and people → meeting_attendees. Requires both to exist.

### Phase 5 — RAG Search (Sprint 4)

Depends on a populated `meetings` table with processed summaries:

1. **Embedding ingestion pipeline** — chunk and embed all existing meetings (backfill migration), then hook into the post-save pipeline.
2. **Vector search endpoint** — the `match_documents()` function already exists from Sprint 0; wire it to FastAPI.
3. **Answer generation** — the final RAG step, combining retrieval with LLM generation.
4. **Search UI** — straightforward once the endpoint works.

### Phase 6 — Projects, Integrations (Sprint 5)

Projects are independent of AI; build them any time after the core data model is established. Calendar and Gmail depend on Google OAuth tokens — ensure the token storage mechanism works before building sync logic.

### Phase 7 — Dashboard + Polish (Sprint 6)

Build last because it aggregates everything that came before. The weekly dashboard has no novel technical complexity — it is a set of SQL aggregate queries. Do not build it until the data it aggregates actually exists.

---

## Common Architecture Patterns

### REST API Design for AI-Augmented Systems

The standard REST resource model works for entities (meetings, tasks, projects, people). The divergence for AI systems is the **processing endpoint pattern**: creating a resource and triggering AI processing are separate concerns.

The pattern used here is correct:
- `POST /meetings` creates the resource (fast, synchronous)
- `POST /meetings/{id}/process` triggers AI processing (slow, returns 202, runs in background)
- `GET /meetings/{id}` polling reveals completion via `processed_at` timestamp

An alternative is Celery task queues with a separate status endpoint, but FastAPI's `BackgroundTasks` is sufficient for a single-user tool where concurrent processing is unlikely.

### React Frontend with Server Components

The App Router pattern for this type of application follows a clear rule: **pages are Server Components; interactive elements are Client Components.**

Dashboard page: Server Component fetches `GET /dashboard/weekly` during render. No client-side JavaScript for the initial load.

Upload form: Client Component — needs browser APIs (FileReader, FormData) and reactive state (upload progress, processing status).

Task status toggle: Client Component — button interaction requires event handlers.

Search input: Client Component — real-time query state.

The `api.ts` wrapper in `lib/api.ts` should export two versions of each fetch function: one for Server Components (no caching, uses `next/headers` for auth token) and one for Client Components (used via TanStack Query). The difference is how the auth token is obtained — Server Components read it from the HTTP-only cookie server-side; Client Components cannot access it directly and must include it in the Authorization header from state.

### PostgreSQL as Application Database

The 9-table relational schema is correctly designed for this domain. Several patterns applied here are standard:

- **UUID primary keys** over serial integers — avoids exposing row count, works across distributed systems, safer for client-generated IDs.
- **JSONB for semi-structured data** (`meetings.summary`, `calendar_events.attendees`) — avoids over-normalization of AI output that may change shape between prompt versions.
- **Soft delete via status fields** rather than physical deletion — preserves referential integrity and audit history.
- **Composite indexes on (status, due_date)** for the task tracker — the most common query pattern (open tasks sorted by due date) is covered by a single index scan.
- **`updated_at` trigger** — do not update this in application code; let the database trigger maintain it to avoid clock skew.

The `activity_log` table provides a lightweight audit trail without requiring an external service. The `entity_type` + `entity_id` pattern allows querying "all changes to meeting X" with a single indexed lookup.

### Authentication Pattern (Supabase + FastAPI)

The dual-client pattern for Supabase Auth with App Router is well-established:

- `lib/supabase/server.ts` — creates a Supabase client that reads/writes cookies. Used in Server Components, Route Handlers, and middleware.
- `lib/supabase/client.ts` — creates a browser Supabase client for Client Components.
- `middleware.ts` — runs on every request to protected routes, calls `supabase.auth.getSession()`, redirects to login if no session.

For FastAPI, the JWT from Supabase is validated using the Supabase JWT secret (HS256). The standard `python-jose` library handles this. The validated token payload contains `sub` (user ID), `email`, and `role`. FastAPI dependency injection (`Depends(get_current_user)`) makes the authenticated user context available to any endpoint.

The important detail is that FastAPI **never issues JWTs** — it only validates JWTs issued by Supabase. This eliminates an entire category of auth complexity (token issuance, refresh, revocation).

### Vector Search Integration

The pgvector + LlamaIndex combination has a specific integration pattern. LlamaIndex's `SupabaseVectorStore` stores and retrieves via direct PostgreSQL connection (not the Supabase REST API), which bypasses the Supabase API layer and is significantly faster for bulk operations.

For this project's scale (a single user, likely hundreds to low thousands of meeting chunks), the HNSW index provides query times well under 100ms. The 5-second RAG target is dominated by embedding generation and LLM answer generation, not vector search.

The LlamaIndex `VectorStoreIndex.as_query_engine()` pattern abstracts the full retrieval pipeline but reduces control over metadata filtering. For date-range filtering and source-type filtering (the requirements in this project), it is better to call `match_documents()` directly via `supabase-py` and assemble the LlamaIndex response manually — this gives full control over the SQL filter parameters while still using LlamaIndex for chunking and embedding.

### OAuth Token Storage for Google APIs

Google Calendar and Gmail require OAuth tokens that expire and need refresh. The pattern in the Technical Architecture (a custom `user_google_tokens` table rather than relying on Supabase's provider token storage) is correct for long-lived background access. Supabase stores OAuth tokens in the session, but sessions expire and are not designed for server-side API calls.

The custom table stores the access token, refresh token, and expiry. A utility function checks token expiry before each Google API call and refreshes automatically. The `google-auth-library` handles this refresh flow. Never store Google tokens in localStorage — they must be server-side only.

### Docker Compose for Local AI Development

The three-service compose setup (frontend, backend, ollama) with an Ollama volume mount is the standard pattern for local LLM development. The key considerations:

- **Ollama health check:** Backend should not start until Ollama is ready. Add a `healthcheck` to the ollama service and `depends_on: ollama: condition: service_healthy` to the backend service.
- **Volume for model persistence:** `ollama_data:/root/.ollama` ensures pulled models survive container restarts. Without this, the 5GB Llama 3 model is re-downloaded on every `docker compose down`.
- **Memory reservation:** The 8GB reservation for Ollama is correct. Llama 3 8B in 4-bit quantization requires approximately 5GB RAM; 8GB provides headroom for context window usage.
- **Backend volume mount:** `./backend:/app` enables hot reload (`--reload` flag in uvicorn) during development without rebuilding the image.

---

*This document reflects the specific stack and requirements of WorkOS. It should be read alongside the Technical Architecture document in `01_Architecture/`.*
