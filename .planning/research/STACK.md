# Stack Research

> Research date: 2026-03-04
> Context: WorkOS — AI-powered work management system for operations managers.
> Single-user, desktop-first, portfolio-grade. ~5 hrs/week dev capacity.

---

## Recommended Stack

### Frontend

#### Next.js 15 (App Router)
- **Version**: 15.x (stable since October 2024; 15.2 released early 2025)
- **Rationale**: The project spec says "Next.js 14+" — Next.js 15 is the current stable release and is backward-compatible with 14 App Router patterns. The App Router (server components, server actions, nested layouts) directly supports the sidebar-navigated, multi-view UI required. React Server Components reduce client-side JavaScript for data-heavy table and calendar views. Turbopack is now stable in dev mode, cutting cold-start times on Apple Silicon significantly. The `next/image`, `next/font`, and built-in TypeScript support remove boilerplate. For a portfolio project, Next.js 15 signals currency with the ecosystem better than pinning to 14.
- **Confidence**: High
- **Note**: Use the App Router exclusively. Do not mix with the Pages Router. The project has no need for Pages Router patterns (SSG for a personal tool adds no value).

#### TypeScript 5.x
- **Version**: 5.4+ (bundled with Next.js 15)
- **Rationale**: Catches API contract mismatches between frontend and FastAPI responses at compile time — critical when the backend returns structured AI output (action items, summaries) that must be consumed safely. Portfolio signal: typed codebases are expected by senior engineering teams. Zero runtime cost.
- **Confidence**: High

#### Tailwind CSS 3.x
- **Version**: 3.4.x (stable; v4 alpha exists but is not production-ready as of early 2026)
- **Rationale**: Utility-first CSS eliminates the context switch between stylesheet and component files, which matters at 5 hrs/week. The JIT compiler means the production bundle only includes classes actually used. Tailwind pairs directly with shadcn/ui's class-based system (both use the same utility primitives). Strong Next.js integration via `postcss`. Avoid Tailwind v4 for now — it is a major breaking rewrite (CSS-first config, Vite-first) and shadcn/ui has not fully migrated to it.
- **Confidence**: High

#### shadcn/ui (latest)
- **Version**: Not versioned as a package — components are copied into the repo via CLI. Use the current CLI (`npx shadcn@latest init`).
- **Rationale**: shadcn/ui is the dominant component library for Next.js App Router projects in 2025. Components are owned by the project (no upstream breaking changes), built on Radix UI primitives (accessible by default), and styled with Tailwind. The library ships exactly the primitives this project needs: `DataTable` (task tracker, people directory), `Dialog` (transcript upload), `Calendar` (meeting calendar view), `Badge` (status chips), `Select` (filters), `Command` (search palette). Owning the components lets you customize without fighting the library.
- **Confidence**: High
- **Key dependencies pulled in**: Radix UI, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (icons)

#### TanStack Table v8
- **Version**: 8.x (stable)
- **Rationale**: shadcn/ui's `DataTable` component is built on TanStack Table. The action item tracker, people directory, and meeting history all require server-side sorting, filtering, and pagination. TanStack Table is headless — it provides logic without imposing markup, which means the Tailwind/shadcn styling is fully preserved. This is the correct choice for any serious data table in 2025; React-Table v7 and ag-Grid Community are the only real alternatives, and both are inferior for this use case (v7 is unmaintained; ag-Grid adds heavy vendor lock-in).
- **Confidence**: High

#### TanStack Query v5
- **Version**: 5.x (stable, released late 2023, widely adopted through 2024-2025)
- **Rationale**: The frontend communicates with a separate FastAPI backend (not Next.js API routes), which means all data fetching is client-side or in server components via `fetch`. TanStack Query handles caching, background refetch, optimistic updates, and loading/error states for client-side fetches — all patterns needed for the dashboard, task status updates, and RAG search results. Its devtools are invaluable for debugging the AI response pipeline during development.
- **Confidence**: High

---

### Backend

#### FastAPI 0.115.x
- **Version**: 0.115.x (current stable as of 2025; 0.100+ introduced the stable Pydantic v2 integration)
- **Rationale**: The project explicitly requires a Python backend to keep AI/ML code (LlamaIndex, Ollama, Anthropic SDK) in the Python ecosystem. FastAPI is the correct choice for this domain in 2025 for four reasons: (1) Auto-generated OpenAPI/Swagger docs at `/docs` — a visible portfolio artifact; (2) Pydantic v2 models for request/response validation of structured AI output (summaries, action items) with ~5x performance improvement over v1; (3) `async`/`await` native support, required for non-blocking LLM API calls and Supabase async client calls; (4) Dependency injection system cleanly isolates the LLM provider abstraction layer (Ollama vs. Claude) for the Protocol pattern. Django and Flask are wrong here: Django is too heavy for a single-user API, and Flask lacks async-first design and auto-docs.
- **Confidence**: High

#### Pydantic v2
- **Version**: 2.7+ (bundled with FastAPI 0.100+)
- **Rationale**: The entire structured output pipeline (transcript → summary schema → action items schema → database write) depends on validated Pydantic models. Pydantic v2's strict mode and `model_validate` make it safe to parse raw LLM JSON output without defensive try/except chains throughout the codebase. The `model_json_schema()` method also lets you generate JSON Schema strings to pass to Claude for structured output / tool use, keeping the schema as the single source of truth.
- **Confidence**: High

#### Python 3.12
- **Version**: 3.12.x (current stable; 3.13 released late 2024 but ecosystem compatibility still catching up)
- **Rationale**: 3.12 brings meaningful performance improvements over 3.11 (especially in the hot path of repeated function calls during transcript processing) and full support across all required packages: LlamaIndex, Anthropic SDK, Supabase Python client, httpx. Stick to 3.12 over 3.13 until the ML ecosystem dependency graph stabilizes.
- **Confidence**: High

#### Uvicorn + Gunicorn
- **Version**: uvicorn 0.30+, gunicorn 22+
- **Rationale**: FastAPI runs on ASGI. Uvicorn is the standard ASGI server. For production (even a personal deployment), Gunicorn as a process manager with Uvicorn workers provides process supervision without needing a separate init system inside Docker. For local dev, `uvicorn --reload` is sufficient.
- **Confidence**: High

---

### Database & Platform

#### Supabase (self-hosted via Docker or Supabase Cloud)
- **Version**: Supabase CLI 2.x; PostgreSQL 15.x (managed by Supabase)
- **Rationale**: Supabase is the single correct choice for this project. It consolidates four services that would otherwise require four separate systems: (1) **PostgreSQL** for the 9-table relational model (meetings, action_items, people, teams, projects, etc.); (2) **pgvector** for RAG embeddings — no separate vector database needed; (3) **Supabase Auth** with Google OAuth — eliminates building an auth system entirely; (4) **Supabase Storage** for raw transcript files (.txt uploads). This is precisely the architectural decision documented in PROJECT.md's Key Decisions table. For a portfolio project, Supabase Cloud's free tier is sufficient, and the Supabase dashboard provides visible evidence of schema design.
- **Confidence**: High

#### PostgreSQL 15 + pgvector 0.7+
- **Version**: PostgreSQL 15 (managed by Supabase); pgvector 0.7.x
- **Rationale**: pgvector 0.7 introduced HNSW indexing, which dramatically improves ANN (approximate nearest neighbor) query performance over the older IVFFlat index. For 768-dimensional embeddings from nomic-embed-text, HNSW provides <5s RAG query performance on datasets of thousands of meeting chunks without requiring a dedicated vector database. The `vector` column type in PostgreSQL means embedding search and relational filtering (e.g., "find similar meetings from Q4 for Project X owned by Person Y") happen in a single SQL query with joins — impossible with a standalone vector database like ChromaDB or Pinecone.
- **Confidence**: High

#### Supabase Python Client v2
- **Version**: `supabase-py` 2.x
- **Rationale**: The v2 client is async-native, matching FastAPI's async architecture. It wraps the PostgREST API and provides typed query builders. Use `AsyncClient` throughout the backend. The auth helpers handle JWT verification for the FastAPI → Supabase trust boundary.
- **Confidence**: High

#### Supabase JS Client v2
- **Version**: `@supabase/supabase-js` 2.x
- **Rationale**: Handles the frontend → Supabase Auth flow (Google OAuth callback, session management, token refresh). In a Next.js App Router project, use the `@supabase/ssr` package alongside it — this is the current recommended pattern for handling cookies-based sessions in server components and route handlers without client-side state races.
- **Confidence**: High

---

### AI / LLM Layer

#### Anthropic Claude API (claude-sonnet-4-x / claude-haiku-4-x)
- **Version**: Anthropic Python SDK 0.40+ (`anthropic>=0.40.0`)
- **Rationale**: For the cloud LLM provider, Claude is the correct choice for this use case for specific reasons: (1) Claude's long-context window (200K tokens) handles long meeting transcripts without chunking the input; (2) Claude's structured output via tool use / JSON mode produces reliable Pydantic-parseable JSON for the summary schema — significantly more reliable than prompt-engineering alone; (3) The Anthropic SDK for Python has excellent async support (`AsyncAnthropic`). Model selection: use `claude-3-5-haiku` for speed-sensitive paths (action item extraction from short segments) and `claude-sonnet-4` for the primary summary generation where quality is paramount. This two-tier approach keeps API costs low while maintaining quality.
- **Confidence**: High

#### Ollama (local inference)
- **Version**: Ollama 0.4+ (current stable as of 2025)
- **Rationale**: Ollama is the correct local inference runtime for Apple Silicon. It uses Metal acceleration on M-series chips, achieving 18-25 tok/s for Llama 3 8B on a 16GB M-series Mac — sufficient for the <2 min summarization target. The OpenAI-compatible REST API (`/api/chat` and `/v1/chat/completions`) means the LLM provider abstraction layer only needs to swap the base URL and model name, not restructure request/response logic. Ollama manages model downloads, quantization selection, and GPU memory allocation automatically.
- **Confidence**: High

#### Llama 3.1 8B (via Ollama)
- **Version**: `llama3.1:8b-instruct-q4_K_M` (4-bit quantized, ~5GB VRAM)
- **Rationale**: Llama 3.1 8B is the correct local model for this task profile in 2025. The instruction-tuned variant follows structured output prompts reliably. The Q4_K_M quantization (4-bit with K-means refinement) hits the optimal quality/speed/memory tradeoff for 16GB Apple Silicon — preserving more than Q4_0 while fitting comfortably in memory. Alternatives: Mistral 7B is slightly faster but less instruction-following reliable; Llama 3 70B exceeds 16GB VRAM; Phi-3 Mini is faster but struggles with long transcript context.
- **Confidence**: High

#### nomic-embed-text (via Ollama)
- **Version**: `nomic-embed-text:v1.5` (via Ollama)
- **Rationale**: This is the embedding model specified in PROJECT.md (768-dim) and is the correct choice. nomic-embed-text v1.5 is specifically designed for long-document embedding (8192 token context, compared to 512 for older models), which is critical for meeting transcript chunks. It runs locally via Ollama, produces consistent 768-dim vectors regardless of LLM provider mode, and eliminates the need for a separate embedding API call to OpenAI or Cohere. The 768-dim choice matches pgvector's optimal performance range — large enough for semantic richness, small enough to avoid excessive storage and index build time.
- **Confidence**: High

#### LlamaIndex 0.11.x
- **Version**: `llama-index-core>=0.11.0` plus relevant integrations (`llama-index-vector-stores-supabase`, `llama-index-embeddings-ollama`, `llama-index-llms-anthropic`, `llama-index-llms-ollama`)
- **Rationale**: LlamaIndex is the correct RAG orchestration framework for this project. It provides: (1) A `VectorStoreIndex` that abstracts the pgvector storage and retrieval; (2) `SentenceSplitter` for chunking transcripts into semantically coherent segments before embedding; (3) `QueryEngine` with built-in re-ranking and source citation metadata — which satisfies the "source citations" requirement in PROJECT.md; (4) The modular integration architecture (separate pip packages per integration) means the local/cloud switch only requires swapping the `embed_model` and `llm` constructor arguments. The v0.11 package restructure (core + integrations) cleaned up the dependency graph significantly. LangChain is the primary alternative but has more abstraction layers than needed for this use case, and its RAG patterns are less opinionated, which creates more boilerplate for the same outcome.
- **Confidence**: High

#### Jinja2 3.x (prompt templating)
- **Version**: 3.1.x (stable; ships with FastAPI's dependencies)
- **Rationale**: As documented in PROJECT.md's Key Decisions, Jinja2 templates for prompts provide version-controllability (prompt changes are visible in git diffs), reviewability (PMs/engineers can read and approve prompt changes in PRs), and swappability (changing a prompt doesn't require touching Python logic). Store templates in `/backend/prompts/*.j2`. This is the correct pattern — DSPy and LMQL are over-engineered for a project at this scale.
- **Confidence**: High

---

### Infrastructure

#### Docker + Docker Compose
- **Version**: Docker 27+, Docker Compose v2 (bundled with Docker Desktop)
- **Rationale**: The project requires running three processes locally: Next.js dev server, FastAPI backend, and Ollama. Docker Compose defines these as a reproducible multi-service stack. This also matches the portfolio expectation — showing a `docker-compose.yml` demonstrates understanding of containerized deployment. For Apple Silicon, use `platform: linux/arm64` in the service definitions to avoid Rosetta emulation overhead. Note: Ollama should run natively on macOS (not inside Docker) during development to access Metal GPU acceleration — the Docker service should only be used for CI/Staging environments.
- **Confidence**: High

#### GitHub Actions
- **Version**: Current (runner: `ubuntu-latest`)
- **Rationale**: GitHub Actions is the standard CI/CD choice for a GitHub-hosted monorepo. The pipeline should run: (1) backend lint (`ruff`) + type-check (`mypy`) + unit tests (`pytest`) on every PR; (2) frontend lint (`eslint`) + type-check (`tsc --noEmit`) + build verification; (3) Optional: Docker build verification. For a single-developer project, this is appropriately scoped — no CD pipeline needed unless deploying to a cloud instance.
- **Confidence**: High

#### Ruff (Python linter/formatter)
- **Version**: 0.4+ (current stable 2025)
- **Rationale**: Ruff replaces flake8, isort, and black in a single tool with dramatically faster execution (written in Rust). This matters for GitHub Actions where each second of CI time adds up. Configure via `pyproject.toml`. This is the 2025 standard for Python projects — flake8 + black is the legacy approach.
- **Confidence**: High

---

### Authentication & Integrations

#### Supabase Auth (Google OAuth)
- **Version**: Managed by Supabase
- **Rationale**: The project requires Google OAuth for both app authentication and to obtain OAuth tokens for Calendar/Gmail API access. Supabase Auth handles the full OAuth flow, stores refresh tokens, and provides a JWT that the FastAPI backend can verify via the Supabase JWT secret. This is a single integration point for auth + Google API access — no need for NextAuth.js or a custom OAuth server.
- **Confidence**: High

#### Google Calendar API / Gmail API (googleapis)
- **Version**: `googleapis` npm package v140+ (frontend), or `google-api-python-client` 2.x (backend — recommended)
- **Rationale**: The Gmail and Calendar integrations should be handled by the FastAPI backend using the Python client, with the access token forwarded from Supabase Auth's stored credentials. Keep Google API calls server-side to avoid exposing tokens to the browser. Scope to read-only as specified in PROJECT.md (`calendar.readonly`, `gmail.readonly`).
- **Confidence**: Medium — The token-forwarding pattern from Supabase Auth → FastAPI → Google API requires careful implementation. Supabase Auth stores the provider token, but accessing it from the backend requires a server-side Supabase client call to retrieve the session. This is achievable but not a single-line integration.

---

## What NOT to Use

### Prisma ORM (frontend)
- The frontend should not hold database logic. All database access goes through the FastAPI backend. Prisma in a Next.js project encourages database calls in server components or API routes, which bypasses the FastAPI layer and splits the data access logic across two stacks. Keep the data layer clean: Next.js → FastAPI → Supabase.

### SQLAlchemy ORM
- The Supabase Python client already provides a query builder for standard CRUD operations. SQLAlchemy adds migration complexity and ORM boilerplate that is unnecessary when the database schema is managed by Supabase migrations. For complex queries, use raw SQL via `supabase.rpc()` or the postgrest query builder. Reserve SQLAlchemy for projects where you control the database server directly.

### ChromaDB / Pinecone / Weaviate
- The entire rationale for Supabase is to avoid a separate vector database. pgvector with HNSW indexing handles the scale this project will ever reach (thousands of meeting chunks) with excellent query performance. Adding ChromaDB reintroduces the multi-system complexity that Supabase was chosen to eliminate.

### LangChain
- LangChain's abstraction layers (chains, agents, memory) are valuable for complex multi-step agent workflows. For this project's RAG use case (embed → store → retrieve → synthesize), LlamaIndex provides a more direct, less abstracted API. LangChain's frequent breaking changes between minor versions have also been a source of maintenance burden in the Python AI ecosystem. LlamaIndex is the more stable choice for RAG-specific workloads.

### NextAuth.js
- Supabase Auth handles Google OAuth. Adding NextAuth.js creates a competing session system and doubles the auth surface area. NextAuth is the right choice when you are NOT using Supabase Auth. When you are, it is redundant.

### React Query + SWR together
- Pick TanStack Query (React Query v5) and use it exclusively. Mixing TanStack Query and SWR for different data sources creates inconsistent caching semantics and two devtools to maintain.

### Tailwind CSS v4 (alpha)
- v4 is a ground-up rewrite with a new CSS-first configuration syntax, breaking changes for most plugin integrations, and shadcn/ui has not fully migrated. Using v4 today will result in blocked upgrades when shadcn releases updates against v3. Wait for the ecosystem to stabilize (mid-2026 estimate).

### Streamlit / Gradio
- Correctly excluded in PROJECT.md's Key Decisions. Both hit hard ceilings for stateful multi-view applications (task manager + calendar + kanban + tables). They are prototyping tools, not portfolio-grade UIs.

### Django REST Framework
- Appropriate for Django-first teams. For a new API-first Python service in 2025, FastAPI provides better async support, auto-docs, and Pydantic v2 integration with far less boilerplate. DRF's ORM coupling also encourages SQLAlchemy-style patterns that conflict with the Supabase client approach.

### Zod (as primary validation at API boundary)
- Zod is excellent for frontend form validation. Do not use it to validate FastAPI responses — that validation should be done server-side in Pydantic before the response is sent. Using Zod on the frontend to re-validate API responses duplicates validation logic and increases bundle size. Use Zod for form schemas (shadcn/ui + React Hook Form patterns) only.

---

## Key Integration Points

### 1. Authentication Flow
```
Browser → Supabase Auth (Google OAuth) → JWT issued
JWT stored in cookie (Supabase SSR pattern)
Next.js Server Component reads cookie → passes Authorization header to FastAPI
FastAPI verifies JWT via Supabase JWT secret → identifies user → proceeds
```
Implementation: `@supabase/ssr` on the frontend; `supabase.auth.get_user(jwt)` on the backend via the async Python client.

### 2. Transcript Upload → AI Processing Pipeline
```
Browser → Next.js (file upload UI)
Next.js → FastAPI POST /transcripts/upload (multipart form)
FastAPI → Supabase Storage (save raw .txt file)
FastAPI → LLM provider (Ollama or Claude) → structured summary JSON
FastAPI → Pydantic validation → PostgreSQL (meetings + action_items tables)
FastAPI → nomic-embed-text → pgvector (chunked embeddings)
FastAPI → response to Next.js (summary + action items)
Next.js → TanStack Query invalidation → UI refresh
```

### 3. LLM Provider Abstraction (Protocol Pattern)
```python
# backend/services/llm/protocol.py
class LLMProvider(Protocol):
    async def complete(self, prompt: str, schema: type[BaseModel]) -> BaseModel: ...

# backend/services/llm/ollama.py  → implements LLMProvider
# backend/services/llm/anthropic.py → implements LLMProvider
# Selected at startup via LLM_PROVIDER env var → injected via FastAPI Depends()
```
The embedding model always uses Ollama (nomic-embed-text) regardless of provider — embeddings are provider-agnostic, preventing re-indexing on provider switch.

### 4. RAG Search Pipeline
```
Browser → Next.js (search input)
Next.js → FastAPI GET /search?q=... (TanStack Query)
FastAPI → nomic-embed-text (embed query, 768-dim vector)
FastAPI → LlamaIndex QueryEngine → pgvector HNSW ANN search
pgvector → top-k chunks with meeting_id, source metadata
LlamaIndex → synthesize answer via LLM provider
FastAPI → response: { answer, sources: [{meeting_id, date, excerpt}] }
Next.js → render answer + source citations
```

### 5. Google Calendar / Gmail Integration
```
Supabase Auth stores Google provider_token (access) + provider_refresh_token
Frontend → FastAPI GET /calendar/events (passes Supabase session JWT)
FastAPI → retrieve provider_token via Supabase admin client
FastAPI → Google Calendar API (read-only) → structured event data
FastAPI → PostgreSQL (cache events) → response to frontend
```
Note: Provider tokens expire; implement refresh logic using `provider_refresh_token` before the Google API call.

### 6. Frontend Data Flow
```
Next.js App Router
├── Server Components → static layout, initial data fetch (Supabase direct or FastAPI)
├── Client Components → interactive elements (upload form, search, task status updates)
│   └── TanStack Query → manages cache, loading states, optimistic updates
├── shadcn/ui components → DataTable, Dialog, Calendar, Badge, Command
└── Tailwind CSS → all styling
```

### 7. Docker Compose Service Graph (local dev)
```yaml
services:
  frontend:  # Next.js, port 3000
    depends_on: [backend]
  backend:   # FastAPI + uvicorn, port 8000
    depends_on: []  # connects to Supabase Cloud
  # Ollama runs natively on macOS for Metal GPU access
  # Supabase runs as Cloud service (free tier) or local Supabase CLI stack
```

### 8. Monorepo Structure → CI Boundary
```
/
├── frontend/   → GitHub Actions: eslint, tsc, next build
├── backend/    → GitHub Actions: ruff, mypy, pytest
└── docker-compose.yml
```
Path filtering in GitHub Actions (`paths: ['backend/**']`, `paths: ['frontend/**']`) ensures only the affected stack is tested on each PR, keeping CI fast at 5 hrs/week dev capacity.

---

## Confidence Summary

| Layer | Technology | Confidence |
|-------|------------|------------|
| Framework | Next.js 15 App Router | High |
| Language (FE) | TypeScript 5.x | High |
| Styling | Tailwind CSS 3.4 | High |
| Components | shadcn/ui (latest) | High |
| Data tables | TanStack Table v8 | High |
| Data fetching | TanStack Query v5 | High |
| Backend | FastAPI 0.115 + Pydantic v2 | High |
| Runtime | Python 3.12 + Uvicorn | High |
| Database | Supabase PostgreSQL 15 | High |
| Vectors | pgvector 0.7 (HNSW) | High |
| Auth | Supabase Auth (Google OAuth) | High |
| Storage | Supabase Storage | High |
| Cloud LLM | Anthropic Claude API (SDK 0.40+) | High |
| Local LLM | Ollama 0.4 + Llama 3.1 8B Q4_K_M | High |
| Embeddings | nomic-embed-text v1.5 via Ollama | High |
| RAG | LlamaIndex 0.11 | High |
| Prompt templates | Jinja2 3.x | High |
| Containers | Docker 27 + Compose v2 | High |
| CI/CD | GitHub Actions | High |
| Python tooling | Ruff 0.4 | High |
| Google APIs | google-api-python-client 2.x | Medium |

*Last updated: 2026-03-04*
