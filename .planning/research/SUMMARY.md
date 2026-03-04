# Research Summary

> Synthesized from STACK.md, FEATURES.md, ARCHITECTURE.md, and PITFALLS.md.
> Date: 2026-03-04

---

## Stack Decision

The original plan holds — no changes required. Every layer has high confidence.

| Layer | Choice | Key rationale |
|---|---|---|
| Frontend | Next.js 15 App Router + TypeScript 5 | Upgrade from 14 is backward-compatible; better portfolio signal |
| Styling / components | Tailwind CSS 3.4 + shadcn/ui | Do NOT use Tailwind v4 (alpha, breaks shadcn); own the components |
| Data layer (FE) | TanStack Query v5 + TanStack Table v8 | Client-side fetching to FastAPI; headless table for all data grids |
| Backend | FastAPI 0.115 + Pydantic v2 + Python 3.12 | Async-first, auto-docs, structured LLM output validation |
| Database | Supabase (PostgreSQL 15 + pgvector 0.7 + Auth + Storage) | Single platform eliminates ChromaDB, S3, and a separate auth system |
| Cloud LLM | Anthropic Claude API (Sonnet for summaries, Haiku for extraction) | 200K context, reliable structured output via tool_use |
| Local LLM | Ollama 0.4 + Llama 3.1 8B Q4_K_M | Metal acceleration on Apple Silicon; run natively, not in Docker |
| Embeddings | nomic-embed-text v1.5 via Ollama (768 dims, always local) | Consistent dims regardless of which LLM provider is active |
| RAG | LlamaIndex 0.11 + pgvector HNSW index | Avoid LangChain; LlamaIndex is more direct for this use case |
| Prompts | Jinja2 3.x templates in `backend/app/ai/prompts/*.j2` | Version-controlled, per-provider variants supported |
| Infra | Docker Compose v2 + GitHub Actions + Ruff | Ollama runs on host (Metal GPU); Supabase Cloud free tier |

**One medium-confidence item:** The Google OAuth token-forwarding pattern (Supabase Auth session -> FastAPI -> Google APIs) requires a custom `user_google_tokens` table and a separate "Connect Google" OAuth flow — the Supabase session token does not carry usable Google API tokens.

---

## Feature Priorities

### V1 — Table Stakes (must ship)

All 10 items below are required for the core value proposition. Absence of any one causes the tool to fail its primary job.

| # | Feature | Complexity | Key dependency |
|---|---|---|---|
| 1 | Google OAuth authentication | Low | Everything else |
| 2 | Transcript ingestion (txt upload + paste) | Low-Med | None |
| 3 | Structured AI summary generation | Med | Ingestion |
| 4 | Action item extraction with owner + due date | Med-High | Summary |
| 5 | Action item status lifecycle tracker | Low-Med | Extraction |
| 6 | Meeting type auto-detection | Low-Med | Summary (parallel) |
| 7 | People directory (CRUD) | Low | Owner resolution |
| 8 | Project tracking with linked meetings | Med | People directory |
| 9 | Semantic search (RAG) across meeting history | High | Ingestion + embeddings |
| 10 | Weekly dashboard | Low-Med | All above |

### Differentiators — Build after V1 core is solid

Ordered by ROI vs. complexity. Stop after item 3 if time is short.

1. **Owner resolution against the people directory** — links extracted names to entities; turns text into navigable data. No competitor does this automatically.
2. **Dual LLM provider with offline mode** — privacy differentiator; strong portfolio signal for architecture maturity.
3. **Google Calendar sync + transcript auto-matching** — pre-populates meeting metadata; privacy-preserving alternative to calendar bots.
4. **Confidence scoring on AI extractions** — builds user trust; surfaces model uncertainty rather than hiding it.
5. **Cross-meeting project intelligence** — RAG scoped to a project; meaningful synthesis competitors cannot do.
6. **Gmail thread import** — extends the tool beyond meetings; high complexity, higher risk of prompt degradation.

### Deliberately out of scope (anti-features)

Real-time transcription, calendar write access, email sending, multi-user collaboration, mobile UI, Jira/Slack/Asana integrations, pre-meeting agenda generation, notification system, fine-tuning.

---

## Architecture Approach

### Guiding principle: strict layer boundaries

```
Next.js (rendering, routing, session)
  → FastAPI (all business logic, AI orchestration, data access)
    → Supabase (PostgreSQL, pgvector, Auth, Storage)
    → LLM providers (Ollama or Claude, never both simultaneously)
```

No direct calls from Next.js to Ollama, Anthropic, or Supabase for data (Auth session management is the exception). This keeps the AI layer testable and the frontend simple.

### Recommended build order

Follow the dependency graph strictly — do not skip ahead.

| Phase | Sprint | What to build | Why first |
|---|---|---|---|
| Infrastructure | 0 | DB schema, FastAPI skeleton, Auth + JWT middleware, LLM Protocol, Next.js scaffold, Docker Compose | Everything depends on this; catches env issues early |
| Core AI pipeline | 1 | File upload, Ollama summarization (one provider, happy path), meeting save, meeting list/detail UI | Validates the hardest technical risk; gets data into the system |
| Task extraction | 2 | Action item extraction, tasks CRUD, task tracker UI | Builds on the established AI pipeline pattern |
| Entity layer | 3 | People + teams CRUD, meeting type detection, person profile page | Required before owner resolution and project linking |
| RAG | 4 | Embedding ingestion pipeline, pgvector HNSW wiring, answer generation, search UI | Requires a populated meetings table; do not build into empty data |
| Integrations | 5 | Google Calendar sync, calendar-to-meeting matching, Gmail import | Requires OAuth from Phase 1 |
| Dashboard + polish | 6 | Weekly dashboard, cross-meeting project intelligence | Pure aggregation; meaningful only when data exists below |

### Key patterns

- **Background tasks for AI processing:** Return `202 Accepted` + job ID immediately; poll `GET /meetings/{id}` until `processed_at` is set. FastAPI `BackgroundTasks` is sufficient — no Celery.
- **LLM provider abstraction:** Python `Protocol` with `generate()` and `generate_structured()`. Factory reads `LLM_PROVIDER` env var. `instructor` library enforces Pydantic schemas across both providers. Provider differences (Claude tool_use vs Ollama JSON mode) are handled inside each implementation — never in callers.
- **Structured output pipeline:** Prompt-level schema + example → `instructor` enforcement → Pydantic validation → database write. Three layers, not one.
- **RAG:** Decouple ingestion (background, post-save) from retrieval (on-demand). Use structural chunking along speaker turns and agenda items — not fixed token windows. Call `match_documents()` PostgreSQL function directly (not via LlamaIndex's VectorStoreIndex) to retain full control over metadata filters and date-range scoping.
- **Auth data fetching rule:** Establish one canonical pattern in Sprint 1 and document it. Recommended: server components for initial layout; TanStack Query in client components for all AI-processed data fetched from FastAPI. Never mix patterns page-by-page.
- **Google tokens:** Store refresh token in a custom `user_google_tokens` table (not the Supabase session). Keep Supabase Auth strictly for identity; run a separate "Connect Google" OAuth flow for API access.

---

## Critical Risks

| # | Pitfall | Prevention strategy |
|---|---|---|
| 1 | **Unstructured LLM output breaks the pipeline** — malformed or variant JSON from Ollama vs Claude causes silent data loss | Use `instructor` library + Pydantic strict validation before any DB write. Log every raw LLM response to a debug table during Sprint 1-2. Include JSON schema and a concrete example in every prompt template. Lock this down before building downstream features. |
| 2 | **Ollama resource contention degrades to 4-6 min / transcript** — Docker memory pressure causes Metal GPU fallback on Apple Silicon | Run Ollama natively on host (not in Docker). Set a 180-second FastAPI timeout with graceful error. Test with realistic transcript lengths (not toy inputs) in Sprint 0/1. |
| 3 | **RLS policies return empty arrays instead of errors** — JWT missing from Supabase client makes auth bugs look like data bugs | Never use the service role key for user-scoped queries in FastAPI. Validate RLS context with a health check query. Write RLS policy tests using the anon role with a test JWT, not the service role. |
| 4 | **Scope creep stalls the project at 60% complete** — "while I'm here" additions compound at 5 hrs/week until no feature is fully shipped | Treat `Out of Scope` in PROJECT.md as a written contract. Park new ideas in `FUTURE.md`. Apply the Definition of Done as a hard gate. One feature at a time. |
| 5 | **Chunking strategy wrong before RAG data is indexed** — fixed token windows cut meeting transcripts mid-decision, degrading retrieval quality permanently | Implement a `MeetingTranscriptNodeParser` that chunks along structural boundaries (speaker turns, agenda items, decisions) before indexing any real data in Sprint 4. Re-indexing everything later is costly. |

Two additional risks to track but not top-5:

- **Prompt drift across providers:** Maintain per-provider Jinja2 template variants (`summarize_claude.j2`, `summarize_ollama.j2`). Run fixture-based regression tests against both providers before merging any prompt change.
- **Signed URL stored instead of storage path:** Store only the Supabase Storage path in the DB; generate signed URLs on demand at read time. Prevent this in Sprint 1 before any data is written.

---

## Key Insights

These findings should directly influence the project plan:

1. **Sprint 0 must produce a vertical slice, not infrastructure.** The pitfalls research is explicit: the only acceptable Sprint 0 acceptance criterion is "one transcript processed end-to-end." Docker polish, CI, and observability are scaffolding built around working features — not prerequisites to them.

2. **Write the demo script before Sprint 1.** Define the 3-minute walkthrough (upload transcript → review summary → find action item → search history) upfront. Every sprint's acceptance criteria should include "demo script works end-to-end." The demo is the product.

3. **Ollama runs on the host, not in Docker.** This is an infrastructure constraint, not an option. Docker + Ollama loses Metal GPU acceleration, making summarization 2-3x slower and potentially blowing the 2-minute target. Document this in the setup guide as a hard requirement.

4. **The Google OAuth integration is more complex than it appears.** Supabase Auth alone does not provide usable Google Calendar/Gmail tokens. A second, explicit OAuth flow is required, storing tokens in a custom table. Plan for this complexity in Sprint 5 — do not assume it is a one-liner.

5. **Structural RAG chunking is not an optimization — it is table stakes.** Fixed-token chunking on meeting transcripts produces low-quality retrieval that users will immediately notice. The `MeetingTranscriptNodeParser` must be designed before Sprint 4 begins, and the Sprint 4 acceptance criteria must include `EXPLAIN ANALYZE` validation of the HNSW index.

6. **Calibrate sprint scope to 8 effective hours, not 10.** At 5 hrs/week with realistic context-switching and debugging overhead, 10-hour sprints will consistently overrun. Set a "shippable" milestone at Sprint 3 (core loop working without RAG or Google integrations) as a safety net if later sprints slip.

7. **pgvector HNSW index and embedding dimension (768) must be enforced at the DDL level in Sprint 0.** `embedding vector(768)` in the schema definition rejects dimension mismatches at write time. Do not rely on application-level checks alone. `CREATE EXTENSION IF NOT EXISTS vector;` is the first line of the initial migration.
