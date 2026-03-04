# WorkOS

## What This Is

WorkOS is an AI-powered work management system for operations managers who run multiple teams. It ingests meeting transcripts, generates structured summaries, extracts action items, tracks projects and personnel, integrates with Google Calendar and Gmail, and enables semantic search across all stored knowledge — designed as a full-stack portfolio project demonstrating modern AI engineering.

## Core Value

A manager uploads a meeting transcript and gets a structured summary with action items extracted, filed, and tracked — in under 2 minutes — replacing 30-60 minutes of manual work per meeting.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Upload .txt meeting transcripts via web UI (file upload or paste)
- [ ] AI-generated structured summaries (overview, topics, decisions, action items, follow-ups)
- [ ] Dual LLM provider support (Ollama local / Claude API cloud) switchable via config
- [ ] Auto-filing with date-based naming convention and meeting type routing
- [ ] Action item extraction with owner, description, and due date
- [ ] Master action tracker with status management (Not Started → In Progress → Complete → Cancelled)
- [ ] People directory with profiles, roles, team assignments
- [ ] Team management with members and team lead
- [ ] Project tracking with status (On Track / At Risk / Blocked / Complete) and linked meetings
- [ ] RAG semantic search across all meeting history with source citations
- [ ] Google Calendar sync (read-only, import events)
- [ ] Gmail integration (read-only, import email as transcript)
- [ ] Weekly dashboard (meetings processed, open tasks, project statuses, upcoming events)
- [ ] Meeting type auto-detection (1:1, team huddle, project review, business partner, other)
- [ ] Google OAuth authentication via Supabase Auth
- [ ] Responsive sidebar-navigated UI with data tables, calendar views, and task management

### Out of Scope

- Real-time transcription — handled by external tools (MacWhisper, Whisper CLI)
- External system integrations (HR, ERP, CRM) — complexity and privacy scope
- Mobile-responsive UI — desktop-only for v1.0
- Multi-user support — single user personal tool
- Cloud backup or sync — data lives in Supabase (user's own instance)
- Voice input — future enhancement
- Calendar write access — read-only sync for v1.0
- Email sending — read-only Gmail access for v1.0

## Context

- Target user: mid-to-senior operations managers managing 4+ teams, 40+ people, 5-15 meetings/week
- Primary pain: 30-60 min manual overhead per meeting for notes, filing, action tracking
- Secondary pain: institutional knowledge siloed across files with no semantic search
- Portfolio goal: demonstrate full-stack AI engineering skills for job applications
- Existing product docs: Vision Statement, PRD (10 features with acceptance criteria), Technical Architecture (16 sections), Definition of Done, Product Backlog (7 sprints), Sprint 0 Plan
- All product docs live in the repo under 00_Product/, 01_Architecture/, 02_Backlog/, 03_Sprints/

## Constraints

- **Dev capacity**: ~5 hours/week, 2-week sprint cadence — conservative scoping required
- **Tech stack**: Next.js 14+ (frontend), FastAPI/Python (backend), Supabase PostgreSQL+pgvector (database), Supabase Auth, Supabase Storage
- **AI providers**: Ollama + Llama 3 8B (local), Claude API via Anthropic SDK (cloud) — switchable via LLM_PROVIDER env var
- **RAG**: LlamaIndex + Supabase pgvector (768-dim embeddings via nomic-embed-text)
- **Infrastructure**: Docker + docker-compose for local dev, GitHub Actions for CI/CD
- **Performance**: Summarization < 2 min (Ollama on 16GB Apple Silicon), < 30 sec (Claude), RAG < 5 sec, UI < 3 sec FCP
- **Privacy**: No personal names or company references in code — generic product
- **Monorepo**: Single repo with /frontend and /backend directories

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase over SQLite + ChromaDB + markdown files | Single platform for auth, database, vectors, and storage. Eliminates 3 separate systems. Shows cloud service proficiency in portfolio. | — Pending |
| Next.js over Streamlit | Portfolio-grade UI with React, TypeScript, component architecture. Streamlit hits interactivity ceiling for task management, calendar, kanban. | — Pending |
| FastAPI as separate backend (not Next.js API routes) | Keeps AI/ML code in Python ecosystem. Auto-generated Swagger docs for portfolio. Independent testability. | — Pending |
| Dual LLM providers (Protocol pattern) | Demonstrates provider abstraction — a portfolio differentiator. Ollama for offline, Claude for quality. | — Pending |
| Entity-centric data model (9 PostgreSQL tables) | Enables complex queries (tasks by person, projects with linked meetings). Replaces flat markdown storage. | — Pending |
| 768-dim embeddings (nomic-embed-text) | Consistent dimensions across local and cloud modes. No re-indexing when switching providers. | — Pending |
| Jinja2 prompt templates | Version-controllable, reviewable in PRs, swappable without code changes. | — Pending |
| Google Calendar/Gmail via OAuth | Real third-party API integration for portfolio. Shared consent screen with Supabase Google Auth. | — Pending |

---
*Last updated: 2026-03-04 after initialization*
