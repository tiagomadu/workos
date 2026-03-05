# WorkOS — AI-Powered Work Management System

An AI-powered work management system that transforms meeting transcripts into structured, actionable work. Upload a transcript and get a structured summary with action items extracted, owners resolved, and everything indexed for semantic search — in under 2 minutes — replacing 30-60 minutes of manual work per meeting.

Built as a full-stack portfolio project demonstrating modern AI engineering, API design, RAG search, and cloud-native deployment.

**Live Demo:** [workos-iota.vercel.app](https://workos-iota.vercel.app) | **API:** [workos-p12f.onrender.com](https://workos-p12f.onrender.com/docs)

---

## Features

| Feature | Description |
|---------|-------------|
| **Transcript Ingestion** | Upload `.txt` files or paste text directly. Supports MacWhisper and Whisper CLI formats with auto-normalisation. |
| **AI Processing Pipeline** | 5-step pipeline: meeting type detection, summarisation, action item extraction, owner resolution, and embedding generation. |
| **Structured Summaries** | AI-generated overview, key topics, decisions, and follow-ups. Editable in-place before saving. |
| **Action Item Extraction** | Automatic owner, description, and due date parsing. Fuzzy owner resolution against the people directory. |
| **RAG Semantic Search** | Ask natural language questions about your meeting history. pgvector similarity search with AI-generated answers and source citations. Falls back to text search when embeddings are unavailable. |
| **Master Task Tracker** | Filter by status, owner, project. Overdue detection with visual indicators. Standalone task creation. |
| **People & Teams** | Directory with profiles, roles, team assignments. Person-level action item stats. Team detail with members and linked projects. |
| **Project Tracking** | Status lifecycle (On Track / At Risk / Blocked), linked meetings, task rollups, and project-level metrics. |
| **Weekly Dashboard** | Meetings processed, action items by urgency (overdue / today / this week / later), active projects with status pills. |
| **Dual LLM Providers** | Switch between Ollama (local, offline) and Claude (cloud) via a single env var. Python Protocol abstraction. |
| **Meeting Type Detection** | Auto-classifies as 1:1, team huddle, project review, business partner, or other with confidence score. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query |
| **Backend** | FastAPI, Python 3.12+, Pydantic v2, async/await |
| **Database** | Supabase PostgreSQL + pgvector (768-dim vectors) |
| **Auth** | Supabase Auth (Google OAuth) |
| **AI — Local** | Ollama + Llama 3.1 8B via instructor |
| **AI — Cloud** | Claude API (Anthropic) via instructor |
| **Embeddings** | nomic-embed-text via Ollama (768-dim) |
| **Prompt Templates** | Jinja2 (version-controlled, reviewable) |
| **Storage** | Supabase Storage (transcripts with signed URLs) |
| **Deployment** | Vercel (frontend) + Render (backend Docker) |

---

## Architecture

```
┌──────────────────────────────────────┐
│       Next.js Frontend               │
│  App Router · React Query · shadcn   │
│  Deployed on Vercel                  │
└─────────────────┬────────────────────┘
                  │ REST API
┌─────────────────▼────────────────────┐
│       FastAPI Backend                │
│  8 Routers · Services · AI Pipeline │
│  Deployed on Render (Docker)        │
└──┬──────────┬──────────┬────────────┘
   │          │          │
┌──▼───┐ ┌───▼────┐ ┌───▼───┐
│Supa- │ │Ollama/ │ │Supa-  │
│base  │ │Claude  │ │base   │
│  DB  │ │  LLM   │ │Storage│
└──────┘ └────────┘ └───────┘
```

### AI Processing Pipeline

```
Upload transcript (.txt or paste)
  → detect_meeting_type (AI — classifies with confidence score)
  → summarise (AI — structured JSON: overview, topics, decisions, follow-ups)
  → extract_action_items (AI — owner, description, due date for each item)
  → resolve_owners (fuzzy match against people directory)
  → generate_embeddings (nomic-embed-text → pgvector for RAG search)
  → completed ✓
```

All steps report real-time progress to the frontend via polling — users see each step animate as it completes.

### RAG Search Pipeline

```
User types natural language question
  → Generate query embedding (nomic-embed-text)
  → pgvector similarity search (HNSW index, cosine distance)
  → Enrich matches with meeting metadata
  → LLM generates answer with source citations
  → Return answer + linked source meetings

Fallback: text-based ILIKE search when embeddings unavailable
```

---

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard — weekly metrics, action items by urgency, active projects |
| `/meetings/new` | Upload or paste transcript, watch AI process in real-time |
| `/meetings/[id]` | Meeting detail with summary, action items, project link |
| `/search` | RAG semantic search across all meetings |
| `/tasks` | Master action item tracker with filters |
| `/projects` | Project list with status indicators |
| `/projects/[id]` | Project detail with linked meetings and task rollups |
| `/people` | People directory with search |
| `/people/[id]` | Person profile with assigned action items |
| `/teams` | Teams list with member counts |
| `/teams/[id]` | Team detail with members, projects, and activity |

---

## API Endpoints

8 routers with full REST API:

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| Health | `/api/v1/health` | Health check |
| Meetings | `/api/v1/meetings` | Upload, paste, get, reprocess, action items, summary, project link |
| People | `/api/v1/people` | CRUD, search, person action items |
| Teams | `/api/v1/teams` | CRUD, team detail with members/projects |
| Tasks | `/api/v1/tasks` | CRUD, filter, bulk update, archive |
| Projects | `/api/v1/projects` | CRUD, archive, detail with linked meetings and task stats |
| Search | `/api/v1/search` | RAG query with date/type filters |
| Dashboard | `/api/v1/dashboard` | Aggregated weekly metrics |

Full Swagger docs at `/docs` on the API server.

---

## Project Structure

```
workos/
├── backend/
│   ├── app/
│   │   ├── ai/              # LLM providers, prompt templates (.j2), schemas
│   │   ├── api/v1/          # 8 FastAPI routers
│   │   ├── core/            # Auth, config, Supabase client
│   │   ├── models/          # Pydantic request/response models
│   │   ├── services/        # Business logic (processing, search, embeddings, etc.)
│   │   └── main.py          # FastAPI app entry point
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages (11 routes)
│   │   ├── components/      # Shared UI components (shadcn/ui)
│   │   ├── lib/             # API client, Supabase helpers
│   │   └── types/           # TypeScript interfaces
│   └── __tests__/
├── supabase/
│   └── migrations/          # PostgreSQL migration files
├── docker-compose.yml
└── .env.example
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ and [Python](https://python.org/) 3.12+
- A [Supabase](https://supabase.com/) project (free tier works)
- [Ollama](https://ollama.com/) (for local LLM) OR [Anthropic API key](https://console.anthropic.com/) (for Claude)

### 1. Clone and configure

```bash
git clone https://github.com/tiagomadu/workos.git
cd workos
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# LLM Provider: "ollama" or "claude"
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=your-api-key

# For local Ollama instead:
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
```

### 2. Run database migrations

Apply in Supabase SQL Editor: `supabase/migrations/00001_init.sql`

### 3. Start development servers

```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

### 4. Open the app

- **App:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs

Sign in with Google, upload a transcript, and watch the AI pipeline process it in real-time.

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **LLM Protocol abstraction** | Python `Protocol` enables swapping between Ollama (offline) and Claude (cloud) with zero code changes. `generate_structured()` uses instructor for reliable JSON output. |
| **Jinja2 prompt templates** | Prompts are version-controlled `.j2` files, not hardcoded strings. Reviewable, testable, and cacheable. |
| **pgvector + HNSW** | Supabase-native vector search — no external vector DB needed. 768-dim nomic-embed-text embeddings with cosine similarity. |
| **Background processing** | FastAPI `BackgroundTasks` for async AI pipeline. Frontend polls status every 2s with React Query. |
| **Fuzzy owner resolution** | Three-tier matching: exact name → alias lookup → fuzzy string matching against people directory. |
| **Text search fallback** | When embedding service is unavailable, search falls back to PostgreSQL ILIKE queries + LLM answer generation. |

---

## License

This project is for portfolio demonstration purposes.
