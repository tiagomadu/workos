# WorkOS — AI-Powered Work Management System

An AI-powered work management system for operations managers. Upload a meeting transcript and get a structured summary with action items extracted, filed, and tracked — in under 2 minutes — replacing 30-60 minutes of manual work per meeting.

Built as a full-stack portfolio project demonstrating modern AI engineering, API design, RAG search, and cloud-native architecture.

---

## Features

- **Transcript ingestion** — Upload `.txt` files or paste text directly. Supports MacWhisper and Whisper CLI formats with automatic normalisation.
- **AI-powered summaries** — Structured output with overview, key topics, decisions, action items, and follow-ups. Editable before saving.
- **Action item extraction** — Automatic owner, description, and due date parsing. Owner resolution against the people directory (exact, alias, and fuzzy matching).
- **Master task tracker** — Filterable by status, owner, project. Overdue detection with visual indicators. Standalone task creation.
- **People and teams** — Directory with profiles, roles, team assignments. Person-level action item stats.
- **Project tracking** — Status lifecycle (On Track / At Risk / Blocked), linked meetings, task rollups.
- **RAG semantic search** — Natural language questions answered from meeting history with source citations. pgvector similarity search with AI-generated answers.
- **Google Calendar sync** — Read-only import of events. Auto-match transcripts to calendar events by date and attendees.
- **Gmail integration** — Browse threads, import email as transcript for AI processing. Stored as meetings with full pipeline execution.
- **Weekly dashboard** — Meetings processed, action items by urgency (overdue/today/this week/later), active projects with status pills, upcoming calendar events.
- **Dual LLM providers** — Switch between Ollama (local) and Claude (cloud) with a single environment variable. Python Protocol abstraction pattern.
- **Meeting type detection** — Auto-classifies as 1:1, team huddle, project review, business partner, or other with confidence score.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query |
| **Backend** | FastAPI, Python 3.12+, Pydantic, async/await |
| **Database** | Supabase PostgreSQL + pgvector (768-dim vectors) |
| **Auth** | Supabase Auth (Google OAuth) |
| **AI — Local** | Ollama + Llama 3.1 8B via instructor |
| **AI — Cloud** | Claude API (Anthropic) via instructor |
| **Embeddings** | nomic-embed-text via Ollama (consistent 768-dim across providers) |
| **Prompt Templates** | Jinja2 (version-controlled, reviewable) |
| **Integrations** | Google Calendar API, Gmail API (read-only OAuth) |
| **Storage** | Supabase Storage (transcripts with signed URLs) |
| **Infrastructure** | Docker, docker-compose, GitHub Actions CI |

---

## Architecture

```
┌──────────────────────────────────────┐
│       Next.js Frontend (:3000)       │
│  App Router · React Query · shadcn   │
└─────────────────┬────────────────────┘
                  │ REST API (46 endpoints)
┌─────────────────▼────────────────────┐
│       FastAPI Backend (:8000)        │
│  10 Routers · Services · AI Agent    │
└──┬──────────┬──────────┬─────────┬───┘
   │          │          │         │
┌──▼───┐ ┌───▼────┐ ┌───▼───┐ ┌──▼────┐
│Supa- │ │Ollama/ │ │Google │ │Supa-  │
│base  │ │Claude  │ │Cal/   │ │base   │
│  DB  │ │  LLM   │ │Gmail  │ │Storage│
└──────┘ └────────┘ └───────┘ └───────┘
```

### Processing Pipeline

```
Upload transcript
  → detect_meeting_type (AI)
  → summarise (AI)
  → extract_action_items (AI)
  → resolve_owners (fuzzy match against people directory)
  → generate_embeddings (nomic-embed-text → pgvector)
  → completed
```

### Data Model

10 PostgreSQL tables: `people`, `teams`, `projects`, `meetings`, `meeting_attendees`, `action_items`, `calendar_events`, `document_embeddings`, `activity_log`, `user_google_tokens`

---

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Ollama](https://ollama.com/) (for local LLM — runs natively on macOS)
- A [Supabase](https://supabase.com/) project (free tier works)
- (Optional) [Anthropic API key](https://console.anthropic.com/) for Claude provider

### 1. Clone and configure

```bash
git clone https://github.com/<your-username>/workos.git
cd workos
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase (from Dashboard > Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# LLM Provider: "ollama" or "claude"
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
ANTHROPIC_API_KEY=          # required if LLM_PROVIDER=claude

# App URLs
NEXT_PUBLIC_API_URL=http://localhost:8000
ALLOWED_ORIGINS=http://localhost:3000
```

### 2. Run database migrations

Apply these in your Supabase SQL Editor (Dashboard > SQL Editor):

1. `supabase/migrations/00001_init.sql` — Core schema (9 tables, indexes, RLS, pgvector)
2. `supabase/migrations/00002_google_tokens.sql` — Google OAuth token storage

### 3. Start Ollama

```bash
ollama serve
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull nomic-embed-text
```

### 4. Start the stack

```bash
docker-compose up
```

### 5. Open the app

- **App:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs (Swagger UI)

Sign in with Google, upload a transcript, and watch the AI pipeline process it.

---

## Development (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
python -m pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
npx vitest run
```

---

## Project Structure

```
workos/
├── backend/
│   ├── app/
│   │   ├── ai/              # LLM providers, prompt templates, factory
│   │   ├── api/v1/          # 10 FastAPI routers (46 endpoints)
│   │   ├── core/            # Auth, config, Supabase client, Google OAuth
│   │   ├── models/          # Pydantic request/response models
│   │   ├── services/        # Business logic (processing, search, tasks, etc.)
│   │   └── main.py          # FastAPI app entry point
│   └── tests/               # 187 pytest tests
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages (dashboard, meetings, tasks, etc.)
│   │   ├── components/      # Shared UI components
│   │   ├── lib/             # API client, Supabase helpers
│   │   └── types/           # TypeScript interfaces
│   └── __tests__/           # 9 vitest tests
├── supabase/
│   └── migrations/          # PostgreSQL migration files
├── .github/workflows/       # CI pipeline
├── docker-compose.yml
└── .env.example
```

---

## API Endpoints

46 REST endpoints across 10 routers:

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| Health | `/api/v1/health` | Health check |
| Meetings | `/api/v1/meetings` | Upload, paste, get, reprocess, action items, summary |
| People | `/api/v1/people` | CRUD, search, person action items |
| Teams | `/api/v1/teams` | CRUD |
| Tasks | `/api/v1/tasks` | CRUD, filter, archive/unarchive |
| Projects | `/api/v1/projects` | CRUD, archive, detail with stats |
| Search | `/api/v1/search` | RAG query with filters |
| Calendar | `/api/v1/calendar` | OAuth flow, sync, events, auto-match, link/unlink |
| Email | `/api/v1/email` | Gmail threads, thread detail, import as meeting |
| Dashboard | `/api/v1/dashboard` | Aggregated weekly metrics |

Full Swagger documentation at http://localhost:8000/docs

---

## Testing

```bash
# Backend — 187 tests
cd backend && python -m pytest tests/ -v

# Frontend — type check + 9 tests
cd frontend && npx tsc --noEmit && npx vitest run
```

---

## Google Calendar & Gmail Setup

1. Create a Google Cloud project and enable Calendar API + Gmail API
2. Create OAuth 2.0 credentials (Web application type)
3. Set authorized redirect URI to `http://localhost:3000/settings`
4. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/settings
   ```
5. In the app, go to Settings and click "Connect Google Account"

---

## Performance

| Metric | Target | Measured |
|--------|--------|----------|
| AI summarisation (Ollama) | < 2 min | Architecture verified |
| AI summarisation (Claude) | < 30 sec | Architecture verified |
| RAG search response | < 5 sec | pgvector HNSW + single LLM call |
| Non-AI API responses | < 3 sec | < 100ms (187 tests in 0.30s) |
| Frontend page load | < 3 sec | Next.js + React Query |

---

## License

This project is for portfolio demonstration purposes.
