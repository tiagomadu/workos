# Features Research

*Scope: AI-powered work management for operations managers. Compared against Fellow.app, Fireflies.ai, Otter.ai, and Notion AI. Grounded in WorkOS project context from PROJECT.md.*

---

## Table Stakes (must have or users leave)

These are features where absence causes immediate abandonment. Users have learned to expect them from the existing tool landscape. If WorkOS does not provide them, there is no reason to switch from a simpler tool.

---

### 1. Transcript Ingestion (text upload or paste)
**Description:** The absolute entry point of the system. Users must be able to get raw transcript text into the system quickly — via file upload (.txt, .md, .vtt, .srt) or direct paste. Without this, nothing else runs. Fellow.app and Fireflies.ai both support multiple ingest formats; Otter.ai auto-transcribes but also accepts imports.

**Why table stakes:** If ingestion is slow, error-prone, or format-restricted, the user's workflow stops at step one. Operations managers with 5-15 meetings/week will not tolerate friction here.

**Complexity:** Low-Medium. File upload via Supabase Storage is straightforward. Format normalization (stripping .vtt timecodes, handling different speaker-label conventions) adds moderate parsing complexity.

**WorkOS relevance:** Already scoped. Ensure the parser handles MacWhisper and Whisper CLI output formats specifically, since those are the stated upstream sources.

---

### 2. Structured AI Summary Generation
**Description:** Given a raw transcript, the system produces a structured document with: a one-paragraph overview, key topics discussed, decisions made, action items, open questions, and follow-up items. This is the core value exchange — 30-60 minutes of manual work replaced in under 2 minutes.

**Why table stakes:** This is the stated core value of WorkOS. Fireflies.ai, Otter.ai, and Fellow.app all provide this. Without it, WorkOS is just a file storage system. The output structure matters: unstructured prose summaries have low utility for busy managers.

**Complexity:** Medium. Prompt engineering for reliable, structured output (JSON schema enforcement or section-delimited text) is the primary effort. LLM output validation and retry logic adds backend complexity. Jinja2 prompt templating (already planned) is the right approach.

**WorkOS relevance:** Already scoped. The dual-provider design (Ollama/Claude) is a meaningful differentiator here — most competitors are cloud-only.

---

### 3. Action Item Extraction with Owner and Due Date
**Description:** From the summary or raw transcript, extract discrete tasks with: task description, assigned person (owner), and due date or timeframe. Each item must be individually trackable. This is table stakes because it is the most immediate, concrete output managers care about — "what do I need to follow up on?"

**Why table stakes:** Fireflies.ai, Fellow.app, Otter.ai, and Notion AI all do this. If WorkOS produces a summary but no structured task list, the user still has to manually read and re-extract, defeating the purpose.

**Complexity:** Medium-High. Entity extraction from conversational text is harder than summarization. "John will follow up on the vendor quote by end of week" requires resolving "John" to a known entity, inferring "end of week" as a relative date, and classifying the task type. Confidence scoring and human-review flagging are necessary for reliability.

**WorkOS relevance:** Already scoped. The people directory (for owner resolution) is a key dependency — extraction quality degrades without a known roster of names.

---

### 4. Action Item Status Lifecycle Management
**Description:** A task tracker where each extracted action item can be advanced through states: Not Started → In Progress → Complete → Cancelled. Users must be able to bulk-view all open items, filter by owner or project, and mark items complete without going back to the original meeting.

**Why table stakes:** Extracted action items that cannot be tracked are worthless. Fellow.app's action item tracker is one of its most-used features precisely because it closes the loop between "meeting happened" and "work got done." Without this, users revert to manually copying items into Jira, Asana, or a spreadsheet.

**Complexity:** Low-Medium. Standard CRUD with status transitions. The complexity is in the UI (sortable, filterable data table) and in keeping the tracker in sync when AI re-extracts or updates items from an amended transcript.

**WorkOS relevance:** Already scoped with the four-state model. Consider adding a "Snoozed/Deferred" state — common request in task management tools.

---

### 5. Meeting Type Detection and Auto-Filing
**Description:** Automatically classify each meeting (1:1, team standup, project review, business partner, executive review, etc.) and file it under the appropriate category with a consistent naming convention. Users should never have to manually organize meetings.

**Why table stakes:** Operations managers running 5-15 meetings/week generate high volumes of meeting records. Without automatic organization, the archive becomes unusable within weeks. Fireflies.ai uses topic detection to auto-tag meetings; Fellow.app uses meeting templates tied to types.

**Complexity:** Low-Medium. Classification is a low-stakes LLM call that can run in parallel with summarization. The naming convention and directory structure logic is simple rule-based code.

**WorkOS relevance:** Already scoped with five meeting types. Consider allowing the user to override the detected type — the model will be wrong occasionally, especially for atypical meetings.

---

### 6. People Directory with Role and Team Assignment
**Description:** A structured registry of every person who appears in meetings: name, role/title, team, and contact reference. Used for action item owner resolution, meeting participant tracking, and filtering.

**Why table stakes:** Without a people model, action item ownership is just a free-text string. "John" in one meeting and "Jonathan" in another are unresolvable as the same person. Semantic search cannot surface "all tasks assigned to the Head of Engineering" without a normalized entity.

**Complexity:** Low. Standard CRUD. The interesting complexity is in auto-suggesting new people when the AI extracts a name not in the directory, prompting the user to add or link them.

**WorkOS relevance:** Already scoped. Consider fuzzy name matching to handle nickname/formal name variations.

---

### 7. Project Tracking with Status and Linked Meetings
**Description:** A lightweight project registry where each project has: name, status (On Track / At Risk / Blocked / Complete), description, team owner, and a list of linked meetings. Action items can be associated with projects. Users get a single-pane view of project health across all their teams.

**Why table stakes:** Operations managers tracking 5+ concurrent projects across 4+ teams cannot rely on meeting notes alone. A project layer that aggregates meetings and tasks is what separates a meeting tool from a work management system. Notion AI has this through its database system; Fellow.app lacks it (its gap); Fireflies.ai lacks it.

**Complexity:** Medium. Project entity CRUD is simple. The interesting complexity is in auto-suggesting project linkage when a meeting or action item mentions a known project name — this requires entity resolution similar to people matching.

**WorkOS relevance:** Already scoped. This is a genuine differentiator vs. Fireflies.ai and Otter.ai, which are meeting-only tools.

---

### 8. Semantic Search (RAG) Across Meeting History
**Description:** A natural-language search interface that finds relevant content across all stored meeting summaries, action items, and transcripts. Queries like "what did we decide about the vendor contract?" or "which meetings discussed the Q3 roadmap?" should return ranked, cited results.

**Why table stakes:** Without search, the meeting archive is a write-only store. The value of institutional memory degrades immediately if it cannot be queried. Notion AI has this via its AI assistant; Fireflies.ai has search but with limited semantic depth. For an operations manager with 6-12 months of meeting history, search is what makes the archive an asset.

**Complexity:** High. Requires: chunking strategy for transcript and summary text, embedding generation (nomic-embed-text), pgvector similarity search, context assembly, LLM-based answer generation with citations, and latency management (target < 5 seconds per query).

**WorkOS relevance:** Already scoped with LlamaIndex + pgvector. The citation requirement (showing which meeting a result came from) is critical for user trust.

---

### 9. Weekly Dashboard / Summary View
**Description:** A single-screen overview showing: meetings processed this week, open action items (count + overdue), project status roll-up, upcoming calendar events, and a "meeting velocity" trend. Designed for a manager's Monday-morning review.

**Why table stakes:** Without a dashboard, users must navigate to each section individually to get a picture of their week. This is the surface that justifies returning to the tool daily. Notion AI relies on manual dashboard construction; Fellow.app has a home view with pending action items and upcoming meetings.

**Complexity:** Low-Medium. Primarily aggregation queries over existing data. Chart/visualization complexity depends on scope — start with counts and status badges before building trend charts.

**WorkOS relevance:** Already scoped. Keep v1 simple: counts, status pills, and a list of upcoming events. Trend charts are a v2 enhancement.

---

### 10. Google OAuth Authentication
**Description:** Secure, single-sign-on via Google account. Required to enable Google Calendar and Gmail integration and to provide a frictionless login experience.

**Why table stakes:** Without authentication, there is no user identity, no multi-session support, and no safe path to Google API access. Supabase Auth with Google OAuth is already the planned implementation.

**Complexity:** Low. Supabase Auth handles the heavy lifting. The complexity is in correctly scoping OAuth permissions and handling token refresh for Calendar and Gmail APIs.

**WorkOS relevance:** Already scoped. Ensure the OAuth consent screen requests only read scopes for Calendar and Gmail to minimize security surface area.

---

## Differentiators (competitive advantage)

These are features that, if executed well, create meaningful separation from existing tools. They are not mandatory for launch but are the features most worth investing in after table stakes are solid.

---

### 1. Dual LLM Provider with Offline Mode (Ollama + Claude)
**Description:** The system runs fully offline with a local Llama 3 model via Ollama, or switches to Claude API for higher-quality output — controlled by a single environment variable. No data leaves the user's machine in offline mode.

**Why it differentiates:** Fireflies.ai, Otter.ai, and Fellow.app are all cloud-only. Operations managers in regulated industries or with confidentiality concerns about sensitive meeting content have no viable alternative. Offline mode addresses a genuine pain point these tools cannot serve. It is also a strong portfolio signal — implementing a provider abstraction pattern demonstrates software architecture maturity.

**Complexity:** Medium. The Protocol/Strategy pattern for LLM providers is already planned. The primary complexity is in prompt parity: prompts tuned for Claude may underperform on Llama 3 8B, requiring per-provider prompt variants.

**Risk:** Llama 3 8B quality on structured extraction (action items, entity resolution) is meaningfully lower than Claude Sonnet/Opus. Set user expectations clearly — offline mode is for privacy, cloud mode is for quality.

---

### 2. Action Item Owner Resolution Against Known People Directory
**Description:** When the AI extracts "Sarah will prepare the budget by Friday," it resolves "Sarah" against the people directory and links the action item to a specific person entity — not just a string. The system flags ambiguous names ("There are 2 Sarahs in the directory — which one?") for user confirmation.

**Why it differentiates:** No competitor does this automatically. Fireflies.ai shows "Sarah" as text. Fellow.app requires manual @mention during the meeting. WorkOS closes this loop post-hoc, turning extracted names into navigable, filterable entity links.

**Complexity:** Medium. Fuzzy string matching + LLM-assisted disambiguation for ambiguous cases. Requires the people directory to be populated first (bootstrapping problem).

---

### 3. Cross-Meeting Project Intelligence
**Description:** Given a project, the system can synthesize: "Based on the last 4 meetings that touched Project Phoenix, here is the current status, open decisions, and outstanding action items." This is a RAG query scoped to a specific project entity, with a generated narrative summary.

**Why it differentiates:** Fireflies.ai and Otter.ai are meeting-level tools — they summarize individual meetings but cannot synthesize across them. Notion AI can do this but requires manual database construction. WorkOS does it automatically because meetings are linked to projects at ingest time.

**Complexity:** High. Requires: reliable meeting-to-project linkage (entity extraction + user confirmation), cross-document RAG retrieval scoped by project, and a synthesis prompt that produces a coherent narrative from fragmented meeting context.

---

### 4. Gmail Integration — Import Email Threads as Quasi-Transcripts
**Description:** Read-only Gmail access allows importing email threads as structured inputs for summarization. An email chain about a vendor negotiation can be processed like a meeting transcript — producing a summary, extracted decisions, and action items.

**Why it differentiates:** No meeting tool does this. It extends the system's utility beyond meetings to the full async communication surface. For operations managers, many decisions happen over email rather than in meetings.

**Complexity:** High. Gmail API thread fetching is straightforward. The complexity is in: thread parsing (multi-sender, reply quoting, HTML-to-text), adapting meeting-oriented prompts to work on email content, and attribution (who said what, in which email).

**Risk:** Email threads are significantly noisier than meeting transcripts. Prompt engineering for email content is a distinct workstream from meeting summarization.

---

### 5. Google Calendar Integration — Meeting Pre-Population
**Description:** Read-only Calendar sync imports upcoming and past meetings with attendees, duration, and recurrence. When a transcript is uploaded, the system auto-matches it to a calendar event, pre-populating the meeting record with metadata (attendees, time, location) rather than requiring manual entry.

**Why it differentiates:** Fireflies.ai does this via direct calendar bot integration (bot joins calls). WorkOS's approach — syncing calendar metadata and matching it to uploaded transcripts — is more privacy-preserving (no bot in the meeting) and works for in-person meetings.

**Complexity:** Medium. Google Calendar API read-only access is well-documented. Fuzzy matching of transcript content to calendar events (by date, duration, participant names) requires heuristic logic with user confirmation for low-confidence matches.

---

### 6. Confidence Scoring on AI Extractions
**Description:** Every AI-extracted element (action item, decision, participant name) is accompanied by a confidence indicator (High / Medium / Low) based on the clarity of the source text. Low-confidence items are flagged for user review before being committed to the tracker.

**Why it differentiates:** No competitor surfaces extraction confidence. Fireflies.ai and Otter.ai show everything with equal weight, leading users to distrust the tool after seeing incorrect extractions. Surfacing confidence makes the system honest about its limitations and builds user trust over time.

**Complexity:** Medium. Confidence can be approximated via prompt-level self-assessment ("How confident are you in this extraction? High/Medium/Low — justify.") or by running a secondary validation pass. The UI must surface this without adding friction to the review workflow.

---

### 7. Jinja2 Prompt Templates as Version-Controlled Configuration
**Description:** All LLM prompts live as named Jinja2 templates in the repository, not hardcoded in Python. Teams (or portfolio reviewers) can inspect, modify, and version-control prompts without touching application code.

**Why it differentiates:** This is primarily a portfolio and maintainability differentiator. For a job-application portfolio project, it demonstrates awareness of prompt engineering as a first-class engineering concern — not an afterthought. It also enables A/B testing of prompt variants by swapping template files.

**Complexity:** Low. Jinja2 is already planned. The complexity is in designing the template schema so variable interpolation is clean and the templates remain readable.

---

## Anti-Features (things to deliberately NOT build)

These are features that are commonly requested or seem natural to add, but would be harmful to the project given its constraints, scope, and goals.

---

### 1. Real-Time Transcription (live mic capture)
**Why to avoid:** This is an entirely separate technical domain — audio capture, speaker diarization, streaming ASR, latency management. It would triple the project scope and add significant infrastructure complexity (WebRTC, streaming backend). MacWhisper and Whisper CLI already solve this problem well. WorkOS should be the downstream processor, not the transcription layer. Building this would delay the core value proposition indefinitely.

---

### 2. Calendar Write Access (creating or modifying events)
**Why to avoid:** Write access to Google Calendar is a fundamentally higher-risk permission scope. It increases OAuth consent screen friction, raises user privacy concerns, and opens the system to bugs that could corrupt a manager's calendar. Read-only is sufficient for v1 and v2. The risk/reward ratio is strongly negative for the current project constraints.

---

### 3. Email Sending / Reply Generation
**Why to avoid:** Sending email on behalf of a user is a high-trust, high-risk action. A bug or LLM hallucination that sends an incorrect email to a stakeholder causes real-world damage. For a single-user portfolio tool, read-only Gmail access captures the intelligence value (what was discussed, what was decided) without the risk. Email sending is a feature for enterprise tools with legal review and explicit user confirmation workflows — not a v1 portfolio project.

---

### 4. Multi-User Collaboration (shared workspaces, team access)
**Why to avoid:** Multi-tenancy is a fundamental architectural change, not a feature addition. It requires: row-level security across all tables, invitation and permission models, conflict resolution for concurrent edits, audit logging, and a significantly more complex auth model. The target user is a single operations manager using this as a personal productivity tool. Multi-user adds complexity without adding portfolio value for the stated AI engineering focus.

---

### 5. Native Mobile App or Mobile-Responsive UI
**Why to avoid:** Operations managers review meeting notes and manage tasks at their desks, not on phones. A mobile-responsive UI would require significant additional design and testing effort for a use case that is not the primary workflow. Desktop-only for v1 is the correct constraint. Responsive CSS can be added later with low effort if needed.

---

### 6. Integrations with External Systems (Jira, Asana, Slack, HubSpot, HR/ERP)
**Why to avoid:** Each integration requires: API authentication, rate limit handling, schema mapping, error recovery, and ongoing maintenance as third-party APIs evolve. For a portfolio project with 5 hours/week of development capacity, a single poorly-maintained integration does more harm to the portfolio impression than no integration at all. The Google Calendar and Gmail integrations are already the maximum reasonable integration surface for v1.

---

### 7. AI-Generated Meeting Agendas (pre-meeting intelligence)
**Why to avoid:** This is a compelling feature (Fellow.app's core differentiator) but it requires a fundamentally different workflow — pre-meeting, not post-meeting. WorkOS is built around post-meeting processing. Adding pre-meeting intelligence would require new UX surfaces (agenda builder, pre-meeting briefing view), new prompt templates, and a different relationship to calendar data. It is a second product, not a feature. Avoid scope creep here.

---

### 8. Notification System (email digests, Slack alerts, push notifications)
**Why to avoid:** Notifications require: a background job scheduler, delivery channel integrations, user preference management, and unsubscribe/suppression logic. They also create ongoing infrastructure maintenance burden (delivery failures, spam classification). For a single-user tool used actively, in-app state is sufficient. The weekly dashboard serves the digest use case without requiring an outbound notification system.

---

### 9. Fine-Tuning or Custom Model Training
**Why to avoid:** Fine-tuning LLMs requires: labeled training data, significant compute, MLOps infrastructure, and expertise in model evaluation. For a portfolio project demonstrating AI engineering, prompt engineering + RAG is the correct demonstration — it is the production pattern used at most companies building on LLMs today. Fine-tuning would add months of work with diminishing portfolio returns.

---

### 10. Voice Input / Audio Upload (direct audio processing)
**Why to avoid:** Processing audio directly (MP3, M4A, WAV) requires: audio pipeline infrastructure, Whisper or equivalent ASR integration, speaker diarization (to produce a usable transcript), and significant latency management. This replicates what MacWhisper and Whisper CLI already do, better. The stated out-of-scope decision is correct — accept text transcripts only, treat audio processing as upstream.

---

## Dependencies Between Features

Understanding build order prevents wasted effort. This section maps which features must exist before others can function correctly.

---

### Hard Dependencies (blocking)

| Feature | Depends On | Reason |
|---|---|---|
| AI Summary Generation | Transcript Ingestion | Cannot summarize what has not been ingested |
| Action Item Extraction | AI Summary Generation | Extracts from the structured summary or raw transcript after the AI pass |
| Action Item Status Tracker | Action Item Extraction | Nothing to track until items are extracted |
| Owner Resolution | People Directory | Cannot link "Sarah" to an entity without a people registry |
| Action Item → Owner Link | Owner Resolution + Action Item Extraction | Both must exist before the link is made |
| Project-Linked Meetings | Project Tracking + Transcript Ingestion | Projects must exist before meetings can be linked to them |
| Action Item → Project Link | Project Tracking + Action Item Extraction | Projects must exist before tasks can be associated |
| RAG Semantic Search | Transcript Ingestion + Embedding Pipeline | Cannot search what has not been embedded; embedding runs post-ingest |
| Cross-Meeting Project Intelligence | RAG + Project-Linked Meetings | Requires both the search infrastructure and project-to-meeting linkage |
| Calendar Pre-Population | Google Calendar Sync + Google OAuth | OAuth must be established before Calendar API calls are possible |
| Gmail Import | Gmail Integration + Google OAuth | Same OAuth dependency as Calendar |
| Weekly Dashboard | All core features (tasks, projects, meetings, calendar) | Dashboard is an aggregation layer — it has no value without data beneath it |
| Google Calendar Sync | Google OAuth | API access requires OAuth token |
| Gmail Integration | Google OAuth | API access requires OAuth token |

---

### Soft Dependencies (quality degrades without, but feature still works)

| Feature | Soft Dependency | Degradation Without It |
|---|---|---|
| Action Item Extraction | People Directory | Owner field becomes a raw string instead of a resolved entity link |
| Meeting Type Detection | Transcript content quality | Classification accuracy drops on very short or heavily redacted transcripts |
| RAG Search Quality | Volume of ingested meetings | Semantic search is most useful with 20+ meetings in the index; sparse indexes produce low-confidence results |
| Project Status Roll-Up | Action item linking to projects | Status is manual/static without task-based health signals |
| Calendar Pre-Population Match Quality | Volume of Calendar events imported | Matching accuracy improves with more calendar data to cross-reference |
| Confidence Scoring | Multiple extraction runs for calibration | Confidence estimates are less calibrated early in system use |

---

### Recommended Build Order (derived from dependencies)

**Phase 1 — Core Pipeline (everything else depends on this)**
1. Google OAuth authentication
2. Transcript ingestion (upload + paste)
3. AI summary generation (Ollama first, Claude second)
4. Action item extraction
5. Action item status tracker

**Phase 2 — Entity Layer (required for intelligence features)**
6. People directory (CRUD)
7. Team management
8. Project tracking (CRUD + status)
9. Owner resolution at extraction time
10. Meeting-to-project linking

**Phase 3 — Intelligence Layer (requires Phase 1 + 2)**
11. RAG embedding pipeline (index on ingest)
12. Semantic search interface
13. Meeting type auto-detection (can be parallelized with Phase 1)

**Phase 4 — Integration Layer (requires OAuth from Phase 1)**
14. Google Calendar sync and import
15. Calendar-to-meeting auto-matching
16. Gmail thread import

**Phase 5 — Synthesis Layer (requires Phases 1-4 for meaningful data)**
17. Weekly dashboard
18. Cross-meeting project intelligence queries

---

## Competitive Positioning Summary

| Feature Area | Fellow.app | Fireflies.ai | Otter.ai | Notion AI | WorkOS |
|---|---|---|---|---|---|
| Meeting summarization | Yes | Yes | Yes | Via AI assistant | Yes |
| Action item extraction | Yes | Yes | Yes | Manual | Yes |
| Action item tracker | Yes (core) | Basic | Basic | Manual Kanban | Yes |
| People/team directory | No | No | No | Manual | Yes |
| Project tracking | No | No | No | Manual DB | Yes |
| Cross-meeting synthesis | No | No | No | Partial | Yes (via RAG) |
| Semantic search | No | Basic keyword | Basic | Yes | Yes (pgvector) |
| Offline / local LLM | No | No | No | No | Yes (Ollama) |
| Gmail import | No | No | No | No | Yes |
| Calendar integration | Yes (write) | Yes (bot join) | Yes (bot join) | No | Yes (read-only) |
| Pre-meeting intelligence | Yes (core) | No | No | No | No (anti-feature) |
| Multi-user collaboration | Yes | Yes | Yes | Yes | No (by design) |

WorkOS occupies a distinct niche: deeper entity modeling (people, teams, projects) than any meeting tool, offline capability no competitor offers, and a cross-meeting synthesis layer that Notion AI approaches but requires manual setup to achieve.

---

*Research completed: 2026-03-04. Based on training knowledge of Fellow.app, Fireflies.ai, Otter.ai, and Notion AI feature sets as of mid-2025, combined with analysis of WorkOS PROJECT.md requirements.*
