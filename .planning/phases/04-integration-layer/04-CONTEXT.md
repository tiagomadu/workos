# Phase 4: Integration Layer - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect Google Calendar and Gmail so users can import external context without leaving WorkOS. Calendar sync imports events for transcript matching. Gmail import converts email threads into meeting records for AI summarisation and RAG indexing.

Covers: CALENDAR-01–07, EMAIL-01–05

</domain>

<decisions>
## Implementation Decisions

### Calendar Sync UX
- **Settings page + events list**: A /settings page with "Connect Google" button initiating OAuth flow for Calendar read-only access. "Sync Now" button for manual one-way sync. Dedicated /calendar page showing imported events in a table (title, date, time, duration, attendees). Settings stores sync status and last synced timestamp.

### Transcript-Calendar Auto-Match
- **Banner on meeting detail**: After AI processing completes, if a calendar event matches by date and attendee names, show a dismissible banner on the meeting detail page: "This may match [Event Name] on [Date]. Link? Yes / No / Choose Other". User can confirm (links calendar_event_id), dismiss (hides banner), or manually browse events to link.

### Gmail Thread Browsing
- **Dedicated email page**: A /emails page showing recent Gmail threads (subject, sender, date, snippet). Click a thread to preview its content. "Import as Meeting" button converts the thread into a meeting record and triggers the full AI processing pipeline.

### Email Thread Storage
- **As meetings with email type**: Imported email threads stored as meeting records with meeting_type="email_thread". The email body text becomes the raw_transcript. Same summary and action item extraction flow. Unified in search results, task tracker, and RAG index. No separate entity needed.

### Claude's Discretion
- Google OAuth flow implementation details (token storage, refresh handling)
- Calendar API pagination and batch fetching
- Auto-match scoring algorithm (date proximity + attendee name overlap)
- Gmail API thread/message fetching and content extraction
- Email thread text normalisation (HTML stripping, threading)
- Error handling for expired/revoked OAuth tokens

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Supabase Auth already handles Google OAuth for app sign-in
- calendar_events table exists from Phase 1 migration (id, user_id, google_event_id, title, start_time, end_time, attendees JSONB, meeting_id FK)
- meetings table has calendar_event_id FK column
- Processing pipeline with 5 sequential steps
- Meeting CRUD and upload/paste patterns

### Integration Points
- Google OAuth needs separate token storage (Calendar/Gmail scopes different from Supabase Auth)
- Calendar sync writes to calendar_events table
- Auto-match queries calendar_events by date, updates meetings.calendar_event_id
- Gmail import creates a meeting record then triggers process_meeting()
- Email summaries get embedded in RAG index via pipeline step 5

</code_context>

<specifics>
## Specific Ideas

- Google Calendar and Gmail use the same OAuth token (both read-only scopes requested together)
- Store Google API tokens in a user_google_tokens table or in Supabase Auth metadata
- Calendar sync fetches events from past 30 days + next 14 days
- Auto-match: same date + any attendee name appears in transcript → suggest match
- Gmail: fetch last 20 threads, show in reverse chronological order
- Email import: concatenate message bodies with "From: / Date: / Subject:" headers between messages

</specifics>

<deferred>
## Deferred Ideas

- Auto-sync on schedule (cron job) — manual sync only for v1
- Gmail search/filter within WorkOS — just show recent threads
- Email reply generation — read-only, never sends email
- Calendar write access — read-only, never modifies events

</deferred>

---

*Phase: 04-integration-layer*
*Context gathered: 2026-03-04*
