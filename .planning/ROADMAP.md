# Roadmap

## Overview

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|-------------|-------|
| 1 | Foundation + Auth + Core AI Pipeline | Stand up the full stack and prove one transcript can be processed end-to-end in under 2 minutes | 28 REQ-IDs | 3 |
| 2 | Entity Layer | Add people, teams, and projects so action items are linked to real entities and navigable as structured data | 22 REQ-IDs | 2 |
| 3 | Intelligence Layer | Enable semantic search across all stored meeting history using RAG with sub-5-second retrieval | 7 REQ-IDs | 1 |
| 4 | Integration Layer | Connect Google Calendar and Gmail so the user can import external context without leaving WorkOS | 12 REQ-IDs | 2 |
| 5 | Synthesis Layer | Deliver the weekly dashboard and verify all performance targets are met across the full system | 10 REQ-IDs | 2 |

---

## Phase 1: Foundation + Auth + Core AI Pipeline

**Goal:** Stand up the full stack and prove one transcript can be processed end-to-end in under 2 minutes.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07, AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09, AI-10, AI-11, AI-12, AI-13, AI-14, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07

### Success Criteria

1. A user can sign in via Google OAuth and land on the app — and sign out — without any manual token handling.
2. A user uploads a `.txt` transcript, sees a processing indicator, and receives a structured summary (overview, topics, decisions, action items, follow-ups) within 2 minutes on Ollama or 30 seconds on Claude.
3. Extracted action items appear on a review screen with owner, description, and due date before being committed to the tracker; items with unresolvable owners are flagged.
4. The meeting type is auto-detected with a confidence indicator shown in the UI.
5. The entire stack starts with `docker-compose up`, and a GitHub Actions CI pipeline passes on every push.

### Plans (3 plans, 3 waves)

- [ ] **01-01-PLAN.md** — Infrastructure + Auth: Docker Compose, Supabase schema (9 tables + pgvector), FastAPI JWT middleware, Next.js scaffold with Google OAuth, GitHub Actions CI *(Wave 1)*
- [ ] **01-02-PLAN.md** — Transcript Ingestion: File upload + paste endpoints, MacWhisper/Whisper CLI normalisation, Supabase Storage, upload UI with preview + processing indicator *(Wave 2)*
- [ ] **01-03-PLAN.md** — AI Processing: LLM Protocol (Ollama + Claude), Jinja2 templates, instructor structured output, summary view + action items table, meeting type detection *(Wave 3)*

---

## Phase 2: Entity Layer

**Goal:** Add people, teams, and projects so action items are linked to real entities and navigable as structured data.

**Requirements:** TASKS-01, TASKS-02, TASKS-03, TASKS-04, TASKS-05, TASKS-06, TASKS-07, TASKS-08, PEOPLE-01, PEOPLE-02, PEOPLE-03, PEOPLE-04, PEOPLE-05, PEOPLE-06, PEOPLE-07, PEOPLE-08, PROJECTS-01, PROJECTS-02, PROJECTS-03, PROJECTS-04, PROJECTS-05, PROJECTS-06

### Success Criteria

1. A user can create people with roles and team assignments, and view a full directory listing.
2. When a transcript is processed, extracted owner names are automatically resolved against the people directory and linked to person entities; ambiguous or missing names are flagged for manual assignment.
3. A user can view all action items from all meetings in a single tracker, filter by owner or project, and advance any item through the full status lifecycle (Not Started → In Progress → Complete → Cancelled).
4. A user can create projects, link meetings to them, update project status, and see all open action items for a project from its detail page.

### Plans

- **2-1: People, Teams, and Owner Resolution** — People and teams CRUD, directory listing UI, person profile page with linked action items, owner resolution logic (name matching against directory, ambiguity flagging).
- **2-2: Task Tracker and Project Tracking** — Master action tracker view with status lifecycle management, sort and filter, manual task creation and editing, archive support, project CRUD with status management, meeting-to-project linking, project detail page.

---

## Phase 3: Intelligence Layer

**Goal:** Enable semantic search across all stored meeting history using RAG with sub-5-second retrieval.

**Requirements:** SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07

### Success Criteria

1. A user types a natural language question and receives a relevant answer with source citations (meeting date and title) in under 5 seconds.
2. All saved meeting summaries are automatically indexed after saving so they are immediately available to search without manual action.
3. The user can filter search results by date range and meeting type, and the vector index uses 768-dimension embeddings consistently regardless of which LLM provider is active.

### Plans

- **3-1: RAG Search** — `MeetingTranscriptNodeParser` with structural chunking (speaker turns, agenda items, decisions), nomic-embed-text embedding pipeline (768-dim, always local), pgvector HNSW index wiring, `match_documents()` PostgreSQL function, background indexing on meeting save, answer generation with source citation, search UI with date range and meeting type filters.

---

## Phase 4: Integration Layer

**Goal:** Connect Google Calendar and Gmail so the user can import external context without leaving WorkOS.

**Requirements:** CALENDAR-01, CALENDAR-02, CALENDAR-03, CALENDAR-04, CALENDAR-05, CALENDAR-06, CALENDAR-07, EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05

### Success Criteria

1. A user can trigger a Google Calendar sync and see imported events (title, date, time, duration, attendees) in the UI, with upcoming events appearing on the dashboard.
2. When a transcript is uploaded, the system surfaces a suggested auto-match to a calendar event based on date and participant names; the user can confirm, dismiss, or manually link to any event.
3. A user can browse Gmail threads in the WorkOS UI, import a thread as a summarisation input, and have the resulting summary indexed in the RAG search alongside meeting summaries — with no email write access ever exercised.

### Plans

- **4-1: Google Calendar Sync** — Custom `user_google_tokens` table and separate "Connect Google" OAuth flow, one-way calendar sync endpoint, imported event UI, transcript-to-event auto-match with confirmation/dismissal, manual link fallback, read-only scope enforcement.
- **4-2: Gmail Integration** — Gmail thread browser in UI, thread import and normalisation for AI summarisation, email summary storage alongside meeting summaries, RAG index inclusion for email content, read-only scope enforcement.

---

## Phase 5: Synthesis Layer

**Goal:** Deliver the weekly dashboard and verify all performance targets are met across the full system.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07

### Success Criteria

1. After signing in, a user lands on the dashboard showing meetings processed in the last 7 days, open action items grouped and highlighted by due date, active project statuses, and upcoming calendar events for the current week.
2. A user can click any dashboard action item and navigate directly to that item in the full tracker.
3. Summarisation completes in under 2 minutes on Ollama and under 30 seconds on Claude; RAG search returns results in under 5 seconds; all non-AI API endpoints respond in under 3 seconds; and the frontend initial page load completes in under 3 seconds — all verified against realistic data volumes.

### Plans

- **5-1: Weekly Dashboard** — Dashboard as the default landing page, meetings-processed count, open action items with due date grouping and overdue visual distinction, active project status pills, upcoming calendar events widget, direct navigation from dashboard item to full tracker.
- **5-2: Performance Verification and Polish** — End-to-end performance validation against all NFR targets, error logging review, CI pipeline verification, UI consistency pass, final demo script walkthrough (upload transcript → review summary → find action item → search history).

---

## Requirement Coverage

| REQ-ID | Phase | Plan |
|--------|-------|------|
| AUTH-01 | 1 | 1-1 |
| AUTH-02 | 1 | 1-1 |
| AUTH-03 | 1 | 1-1 |
| AUTH-04 | 1 | 1-1 |
| AUTH-05 | 1 | 1-1 |
| AUTH-06 | 1 | 1-1 |
| AUTH-07 | 1 | 1-1 |
| INGEST-01 | 1 | 1-2 |
| INGEST-02 | 1 | 1-2 |
| INGEST-03 | 1 | 1-2 |
| INGEST-04 | 1 | 1-2 |
| INGEST-05 | 1 | 1-2 |
| INGEST-06 | 1 | 1-2 |
| INGEST-07 | 1 | 1-2 |
| AI-01 | 1 | 1-3 |
| AI-02 | 1 | 1-3 |
| AI-03 | 1 | 1-3 |
| AI-04 | 1 | 1-3 |
| AI-05 | 1 | 1-3 |
| AI-06 | 1 | 1-3 |
| AI-07 | 1 | 1-3 |
| AI-08 | 1 | 1-3 |
| AI-09 | 1 | 1-3 |
| AI-10 | 1 | 1-3 |
| AI-11 | 1 | 1-3 |
| AI-12 | 1 | 1-3 |
| AI-13 | 1 | 1-3 |
| AI-14 | 1 | 1-3 |
| INFRA-01 | 1 | 1-1 |
| INFRA-02 | 1 | 1-1 |
| INFRA-03 | 1 | 1-3 |
| INFRA-04 | 1 | 1-3 |
| INFRA-05 | 1 | 1-1 |
| INFRA-06 | 5 | 5-2 |
| INFRA-07 | 5 | 5-2 |
| TASKS-01 | 2 | 2-2 |
| TASKS-02 | 2 | 2-2 |
| TASKS-03 | 2 | 2-2 |
| TASKS-04 | 2 | 2-2 |
| TASKS-05 | 2 | 2-2 |
| TASKS-06 | 2 | 2-2 |
| TASKS-07 | 2 | 2-2 |
| TASKS-08 | 2 | 2-2 |
| PEOPLE-01 | 2 | 2-1 |
| PEOPLE-02 | 2 | 2-1 |
| PEOPLE-03 | 2 | 2-1 |
| PEOPLE-04 | 2 | 2-1 |
| PEOPLE-05 | 2 | 2-1 |
| PEOPLE-06 | 2 | 2-1 |
| PEOPLE-07 | 2 | 2-1 |
| PEOPLE-08 | 2 | 2-1 |
| PROJECTS-01 | 2 | 2-2 |
| PROJECTS-02 | 2 | 2-2 |
| PROJECTS-03 | 2 | 2-2 |
| PROJECTS-04 | 2 | 2-2 |
| PROJECTS-05 | 2 | 2-2 |
| PROJECTS-06 | 2 | 2-2 |
| SEARCH-01 | 3 | 3-1 |
| SEARCH-02 | 3 | 3-1 |
| SEARCH-03 | 3 | 3-1 |
| SEARCH-04 | 3 | 3-1 |
| SEARCH-05 | 3 | 3-1 |
| SEARCH-06 | 3 | 3-1 |
| SEARCH-07 | 3 | 3-1 |
| CALENDAR-01 | 4 | 4-1 |
| CALENDAR-02 | 4 | 4-1 |
| CALENDAR-03 | 4 | 4-1 |
| CALENDAR-04 | 4 | 4-1 |
| CALENDAR-05 | 4 | 4-1 |
| CALENDAR-06 | 4 | 4-1 |
| CALENDAR-07 | 4 | 4-1 |
| EMAIL-01 | 4 | 4-2 |
| EMAIL-02 | 4 | 4-2 |
| EMAIL-03 | 4 | 4-2 |
| EMAIL-04 | 4 | 4-2 |
| EMAIL-05 | 4 | 4-2 |
| DASH-01 | 5 | 5-1 |
| DASH-02 | 5 | 5-1 |
| DASH-03 | 5 | 5-1 |
| DASH-04 | 5 | 5-1 |
| DASH-05 | 5 | 5-1 |
| DASH-06 | 5 | 5-1 |

**Coverage:** 79 of 79 v1 requirements mapped. 0 unmapped.

---
*Created: 2026-03-04*
