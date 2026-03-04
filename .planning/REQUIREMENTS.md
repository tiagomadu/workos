# Requirements: WorkOS

**Defined:** 2026-03-04
**Core Value:** A manager uploads a meeting transcript and gets a structured summary with action items extracted, filed, and tracked — in under 2 minutes — replacing 30-60 minutes of manual work per meeting.

---

## v1 Requirements

Requirements for initial release. Covers PRD MVP (F-01–F-06), PRD v1.0 (F-07–F-10), plus People/Teams, Google Calendar, Gmail, and Auth.

---

### Authentication

- [ ] **AUTH-01**: User can sign in via Google OAuth through the Supabase Auth consent screen
- [ ] **AUTH-02**: User is redirected to the dashboard after successful Google sign-in
- [ ] **AUTH-03**: User session persists across browser refresh without re-authenticating
- [ ] **AUTH-04**: User can sign out and session is invalidated immediately
- [ ] **AUTH-05**: Unauthenticated requests to protected routes are redirected to the sign-in page
- [ ] **AUTH-06**: OAuth token is stored securely and refreshed automatically before expiry
- [ ] **AUTH-07**: Google OAuth consent screen requests only read scopes for Calendar and Gmail

---

### Transcript Ingestion

- [ ] **INGEST-01**: User can upload a `.txt` file via the web UI and have it accepted without error (F-01 / AC-01)
- [ ] **INGEST-02**: User can paste raw transcript text directly into a text area as an alternative to file upload (F-01 / AC-05)
- [ ] **INGEST-03**: User sees a clear error message when an invalid file type is uploaded (F-01 / AC-04)
- [ ] **INGEST-04**: User can upload transcripts with or without speaker labels and the system processes both correctly (F-01 / AC-02)
- [ ] **INGEST-05**: User can upload transcripts up to 500KB without processing errors (F-01 / AC-03)
- [ ] **INGEST-06**: User can upload transcripts in MacWhisper and Whisper CLI output formats and have them normalised correctly
- [ ] **INGEST-07**: User sees a processing indicator while the transcript is being ingested and summarised

---

### AI Processing

- [ ] **AI-01**: User receives a structured summary containing overview, key topics, decisions, action items, and follow-ups after uploading a transcript (F-02 / AC-01)
- [ ] **AI-02**: User sees the summary rendered in a consistent markdown template on every run (F-02 / AC-02)
- [ ] **AI-03**: User receives the summary in under 2 minutes when using the local Ollama provider (F-02 / AC-03)
- [ ] **AI-04**: User receives the summary in under 30 seconds when using the Claude API provider
- [ ] **AI-05**: User can edit the generated summary in the UI before saving (F-02 / AC-04)
- [ ] **AI-06**: User can re-run summarisation on the same transcript if the initial output quality is unsatisfactory (F-02 / AC-06)
- [ ] **AI-07**: User can switch the active LLM provider between Ollama and Claude by changing a single environment variable (`LLM_PROVIDER`) without code changes
- [ ] **AI-08**: User sees extracted action items displayed for review before they are committed to the tracker, with owner, description, and due date (F-04 / AC-01, AC-02)
- [ ] **AI-09**: User can add, edit, or delete extracted action items on the review screen before confirming (F-04 / AC-03)
- [ ] **AI-10**: User sees items without a resolvable owner flagged for manual assignment (F-04 / AC-05)
- [ ] **AI-11**: System auto-detects meeting type (1:1, team huddle, project review, business partner, other) from transcript content (F-10 / AC-01)
- [ ] **AI-12**: User sees a confidence indicator alongside the detected meeting type (F-10 / AC-02)
- [ ] **AI-13**: System uses Jinja2 prompt templates stored in the repository so prompts can be reviewed and modified without changing application code
- [ ] **AI-14**: System returns a graceful error to the UI and logs the failure if the LLM provider is unreachable, without losing the ingested transcript

---

### Task Management

- [ ] **TASKS-01**: User can view all action items from all meetings in a single master tracker view (F-06 / AC-01)
- [ ] **TASKS-02**: User can see each action item's task description, owner, due date, source meeting, and current status (F-06 / AC-02)
- [ ] **TASKS-03**: User can advance an action item through the status lifecycle: Not Started → In Progress → Complete → Cancelled (F-06 / AC-03, AC-04)
- [ ] **TASKS-04**: User can sort the tracker by due date (F-06 / AC-05)
- [ ] **TASKS-05**: User can filter the tracker by owner or by project
- [ ] **TASKS-06**: User can manually create a new action item from the tracker without going through transcript ingestion
- [ ] **TASKS-07**: User can edit an existing action item's description, owner, due date, or project link
- [ ] **TASKS-08**: User can archive completed or cancelled items to keep the active tracker uncluttered (F-06 / AC-06)

---

### People and Teams

- [ ] **PEOPLE-01**: User can create a person profile with name, role/title, and team assignment
- [ ] **PEOPLE-02**: User can edit an existing person profile's name, role, or team assignment
- [ ] **PEOPLE-03**: User can view a directory listing of all people with their role and team
- [ ] **PEOPLE-04**: User can create a team with a name and designated team lead
- [ ] **PEOPLE-05**: User can assign or remove members from a team
- [ ] **PEOPLE-06**: System resolves an extracted action item owner name against the people directory and links the item to a person entity when a match is found
- [ ] **PEOPLE-07**: System flags an extracted owner name for manual resolution when the name is ambiguous (matches more than one person) or absent from the directory
- [ ] **PEOPLE-08**: User can view all action items assigned to a specific person from that person's profile page

---

### Project Tracking

- [ ] **PROJECTS-01**: User can create a project with name, description, status, and owning team (F-08 / AC-01)
- [ ] **PROJECTS-02**: User can update a project's status: On Track, At Risk, Blocked, Complete (F-08 / AC-04)
- [ ] **PROJECTS-03**: User can link a meeting to an existing project (F-08 / AC-02)
- [ ] **PROJECTS-04**: User can view all open action items associated with a project from the project detail page (F-08 / AC-03)
- [ ] **PROJECTS-05**: User can view a list of all projects with their current status from the projects index
- [ ] **PROJECTS-06**: User can archive a completed project so it no longer appears in the active project list

---

### RAG Semantic Search

- [ ] **SEARCH-01**: User can type a natural language question and receive a relevant answer drawn from stored meeting content (F-07 / AC-01)
- [ ] **SEARCH-02**: User sees each answer accompanied by a source citation showing the meeting date and meeting title (F-07 / AC-02)
- [ ] **SEARCH-03**: User receives search results in under 5 seconds (F-07 / AC-04)
- [ ] **SEARCH-04**: System indexes all saved meeting summaries automatically so they are available to search immediately after saving (F-07 / AC-05, AC-06)
- [ ] **SEARCH-05**: User can filter search results by date range
- [ ] **SEARCH-06**: User can filter search results by meeting type
- [ ] **SEARCH-07**: System generates 768-dimension embeddings using nomic-embed-text so the vector index is consistent whether the active provider is Ollama or Claude

---

### Google Calendar Integration

- [ ] **CALENDAR-01**: User can trigger a one-way sync that imports upcoming and recent Google Calendar events into WorkOS
- [ ] **CALENDAR-02**: User can view imported calendar events in the UI showing title, date, time, duration, and attendees
- [ ] **CALENDAR-03**: System attempts to auto-match an uploaded transcript to a calendar event based on date and participant names, and surfaces the suggested match to the user
- [ ] **CALENDAR-04**: User can confirm or dismiss an auto-match between a transcript and a calendar event
- [ ] **CALENDAR-05**: User can manually link a transcript to any imported calendar event when no auto-match is found
- [ ] **CALENDAR-06**: Upcoming calendar events from the current week appear in the weekly dashboard view
- [ ] **CALENDAR-07**: Calendar sync uses only read-only OAuth scopes and never modifies any calendar event

---

### Gmail Integration

- [ ] **EMAIL-01**: User can browse recent Gmail threads from within the WorkOS UI using read-only Gmail API access
- [ ] **EMAIL-02**: User can select a Gmail thread and import it as a structured input for AI summarisation
- [ ] **EMAIL-03**: System generates a summary from an imported email thread containing overview, key decisions, and extracted action items
- [ ] **EMAIL-04**: Imported email summaries are stored alongside meeting summaries and included in the RAG search index
- [ ] **EMAIL-05**: System uses only read-only Gmail OAuth scopes and never sends, drafts, or modifies any email

---

### Dashboard

- [ ] **DASH-01**: User sees the dashboard as the default landing page after signing in (F-09 / AC-04)
- [ ] **DASH-02**: User sees the count of meetings processed in the last 7 days (F-09 / AC-01)
- [ ] **DASH-03**: User sees all open action items grouped by due date, with overdue items visually distinguished (F-09 / AC-02)
- [ ] **DASH-04**: User sees all active projects with their current status pill (F-09 / AC-03)
- [ ] **DASH-05**: User sees upcoming Google Calendar events for the current week on the dashboard (requires CALENDAR-01)
- [ ] **DASH-06**: User can navigate from a dashboard action item directly to that item in the full tracker

---

### Infrastructure

- [ ] **INFRA-01**: User can start the entire application stack (frontend + backend + database) with a single `docker-compose up` command
- [ ] **INFRA-02**: All environment-specific configuration (API keys, provider selection, Supabase credentials) is managed via a `.env` file with a documented `.env.example`
- [ ] **INFRA-03**: Application recovers from a failed LLM call without crashing and logs sufficient detail to debug the failure (PRD NFR-04)
- [ ] **INFRA-04**: All application errors are written to a local log file with timestamp, severity, and request context (PRD NFR-07)
- [ ] **INFRA-05**: GitHub Actions CI pipeline runs linting and unit tests on every push to the main branch
- [ ] **INFRA-06**: Frontend initial page load completes in under 3 seconds on local machine (F-05 / AC-07)
- [ ] **INFRA-07**: Backend API endpoints return responses in under 3 seconds for all non-AI operations

---

## v2 Requirements

Deferred to future release. Derived from PRD backlog items FU-01 through FU-10. Not in current roadmap.

### AI Processing

- **AI-V2-01**: System surfaces a confidence score (High / Medium / Low) alongside every AI-extracted element so the user can prioritise manual review
- **AI-V2-02**: System supports per-provider prompt variants so prompts are independently tuned for Ollama (Llama 3 8B) vs. Claude without degrading quality on either
- **AI-V2-03**: User can query a specific project and receive a synthesised narrative summary across all meetings linked to that project (cross-meeting project intelligence)

### Task Management

- **TASKS-V2-01**: User can set a task status of Snoozed/Deferred with an optional wake date
- **TASKS-V2-02**: User can export the action tracker to CSV

### Search

- **SEARCH-V2-01**: User can scope a RAG query to a specific project and receive results only from meetings linked to that project
- **SEARCH-V2-02**: Search results include a relevance score so the user can judge result quality

### Dashboard

- **DASH-V2-01**: Dashboard shows a meeting velocity trend chart (meetings per week over the last 8 weeks)
- **DASH-V2-02**: Dashboard refreshes automatically when underlying data changes without a manual page reload (F-09 / AC-05)

### Projects

- **PROJECTS-V2-01**: System auto-suggests linking a newly ingested meeting to an existing project when the project name appears in the transcript

### People

- **PEOPLE-V2-01**: System uses fuzzy name matching to handle nickname and formal name variations when resolving action item owners (e.g., "Jon" matching "Jonathan")

---

## Out of Scope

Explicitly excluded for v1 and v2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time transcription (live mic, audio upload) | Separate technical domain — audio capture, ASR, diarization. MacWhisper and Whisper CLI handle this upstream. Adding it would triple scope. |
| Calendar write access (creating or modifying events) | Higher-risk OAuth scope, increased consent screen friction, risk of corrupting user calendars. Read-only is sufficient. |
| Email sending or reply generation | Sending email on behalf of a user creates real-world risk from LLM hallucination or bugs. Read-only Gmail is the correct boundary. |
| Multi-user collaboration and shared workspaces | Requires row-level security, invitation model, permission management, and concurrent edit handling — a fundamental architectural change. |
| Mobile-responsive UI | Operations managers work at desks. Mobile adds design/testing effort for a non-primary workflow. Desktop-only for v1. |
| External system integrations (Jira, Asana, Slack, HubSpot, HR/ERP) | Each integration adds maintenance burden. Google Calendar + Gmail is the maximum integration surface for v1. |
| AI-generated meeting agendas (pre-meeting intelligence) | Pre-meeting workflow is a different product. Requires new UX surfaces and a different relationship to calendar data. |
| Notification system (email digests, push, Slack alerts) | Requires background job scheduler, delivery channel integrations, and preference management. Weekly dashboard covers the digest use case. |
| Fine-tuning or custom model training | Requires labelled data, significant compute, and MLOps infrastructure. Prompt engineering + RAG is the correct demonstration pattern. |
| Voice input or direct audio file processing (MP3, M4A, WAV) | Replicates what MacWhisper does, better. Accept text transcripts only. |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| INGEST-01 | Phase 1 | Pending |
| INGEST-02 | Phase 1 | Pending |
| INGEST-03 | Phase 1 | Pending |
| INGEST-04 | Phase 1 | Pending |
| INGEST-05 | Phase 1 | Pending |
| INGEST-06 | Phase 1 | Pending |
| INGEST-07 | Phase 1 | Pending |
| AI-01 | Phase 1 | Pending |
| AI-02 | Phase 1 | Pending |
| AI-03 | Phase 1 | Pending |
| AI-04 | Phase 1 | Pending |
| AI-05 | Phase 1 | Pending |
| AI-06 | Phase 1 | Pending |
| AI-07 | Phase 1 | Pending |
| AI-08 | Phase 1 | Pending |
| AI-09 | Phase 1 | Pending |
| AI-10 | Phase 1 | Pending |
| AI-11 | Phase 1 | Pending |
| AI-12 | Phase 1 | Pending |
| AI-13 | Phase 1 | Pending |
| AI-14 | Phase 1 | Pending |
| TASKS-01 | Phase 2 | Pending |
| TASKS-02 | Phase 2 | Pending |
| TASKS-03 | Phase 2 | Pending |
| TASKS-04 | Phase 2 | Pending |
| TASKS-05 | Phase 2 | Pending |
| TASKS-06 | Phase 2 | Pending |
| TASKS-07 | Phase 2 | Pending |
| TASKS-08 | Phase 2 | Pending |
| PEOPLE-01 | Phase 2 | Pending |
| PEOPLE-02 | Phase 2 | Pending |
| PEOPLE-03 | Phase 2 | Pending |
| PEOPLE-04 | Phase 2 | Pending |
| PEOPLE-05 | Phase 2 | Pending |
| PEOPLE-06 | Phase 2 | Pending |
| PEOPLE-07 | Phase 2 | Pending |
| PEOPLE-08 | Phase 2 | Pending |
| PROJECTS-01 | Phase 2 | Pending |
| PROJECTS-02 | Phase 2 | Pending |
| PROJECTS-03 | Phase 2 | Pending |
| PROJECTS-04 | Phase 2 | Pending |
| PROJECTS-05 | Phase 2 | Pending |
| PROJECTS-06 | Phase 2 | Pending |
| SEARCH-01 | Phase 3 | Pending |
| SEARCH-02 | Phase 3 | Pending |
| SEARCH-03 | Phase 3 | Pending |
| SEARCH-04 | Phase 3 | Pending |
| SEARCH-05 | Phase 3 | Pending |
| SEARCH-06 | Phase 3 | Pending |
| SEARCH-07 | Phase 3 | Pending |
| CALENDAR-01 | Phase 4 | Pending |
| CALENDAR-02 | Phase 4 | Pending |
| CALENDAR-03 | Phase 4 | Pending |
| CALENDAR-04 | Phase 4 | Pending |
| CALENDAR-05 | Phase 4 | Pending |
| CALENDAR-06 | Phase 4 | Pending |
| CALENDAR-07 | Phase 4 | Pending |
| EMAIL-01 | Phase 4 | Pending |
| EMAIL-02 | Phase 4 | Pending |
| EMAIL-03 | Phase 4 | Pending |
| EMAIL-04 | Phase 4 | Pending |
| EMAIL-05 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| DASH-06 | Phase 5 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| INFRA-07 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 79 total
- Mapped to phases: 79
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition from PRD v1.0 + People/Teams + Calendar + Gmail + Auth*
