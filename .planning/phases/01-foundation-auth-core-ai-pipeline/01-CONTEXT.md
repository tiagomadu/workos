# Phase 1: Foundation + Auth + Core AI Pipeline - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the full stack (Docker Compose, Supabase, FastAPI, Next.js) and prove one transcript can be processed end-to-end — from Google OAuth sign-in through transcript upload to structured AI summary with extracted action items — in under 2 minutes on Ollama or 30 seconds on Claude.

Covers: AUTH-01–07, INGEST-01–07, AI-01–14, INFRA-01–05

</domain>

<decisions>
## Implementation Decisions

### Transcript Upload Experience

- **Single page with tabs**: One "New Meeting" page with two tabs — "Upload File" (drag-and-drop zone + file picker) and "Paste Text" (large textarea). Clean, focused, minimal clicks.
- **Large centered drag-and-drop zone**: Big dashed-border area in the center with an upload cloud icon, "Drag & drop your .txt file here" text, and a "Browse" button below. Standard modern pattern.
- **Brief preview before processing**: After file selection, show filename, file size, first ~10 lines of transcript text, and a "Process" button. Lets the user confirm they picked the right file before triggering the 30s–2min AI call.
- **Optional metadata form alongside preview**: Show optional fields (title, date, project) next to the file preview. Pre-fill with smart defaults — filename maps to title, today's date maps to date. User can skip; AI fills in later.

### Summary & Results Presentation

- **Full-page summary with collapsible sections**: Summary rendered as a full page. Sections (Overview, Key Topics, Decisions, Action Items, Follow-ups) displayed as expandable/collapsible accordion blocks. All expanded by default for immediate reading.
- **Toggle edit mode**: An "Edit" button in the top bar toggles the summary from read-only rendered markdown to an editable markdown textarea. Save/Cancel buttons appear. Standard CMS pattern.
- **Post-processing landing**: After AI completes, user lands on the full summary page. Action items appear in their own section at the bottom with a "Review & Save" CTA that navigates to the action item review flow.
- **Meeting type badge**: Pill/badge at the top of the summary page next to the meeting title showing detected type and confidence (e.g., "Team Huddle — High Confidence"). Visible but not distracting.

### Action Item Review Flow

- **Editable table**: Clean data table with columns — Owner, Description, Due Date, Status. Each cell is inline-editable. Add/delete row buttons. Familiar spreadsheet-like interaction using shadcn/ui Table.
- **Unresolvable owner flagging**: Owner cell shows extracted name in orange/yellow with a warning icon when no match found in people directory. Clicking opens a dropdown to: assign to existing person, create new person, or leave as text. Non-blocking — user can save and fix later.
- **Bulk confirm**: Review all items in the table, edit any individual items, then one "Save All" button at the bottom. Fastest for the common case where most items are correct.
- **Default due dates**: When no due date is extracted from the transcript, pre-fill with 1 week from today. User can change during review. Prevents items from having no due date.

### Processing Feedback UX

- **Multi-step progress indicator**: Show named processing steps — "Parsing transcript..." → "Generating summary..." → "Extracting action items..." → "Detecting meeting type...". Each step shows a spinner, then a checkmark when complete. Gives a real sense of progress.
- **Same-page transition**: Upload form morphs into the processing indicator, then transitions to the summary view. No page navigation. Smooth SPA-like experience in Next.js.
- **Inline error with retry**: Error message replaces the progress indicator — "Processing failed: [reason]. Your transcript is saved." with a "Retry" button and a "Switch Provider" link. Transcript is never lost.
- **Subtle provider indicator**: Small label during processing — "Using Ollama (local)" or "Using Claude (cloud)". Informational, not prominent. Helps debugging and showcases the dual-provider portfolio feature.

### Claude's Discretion

- Infrastructure decisions (Docker Compose structure, CI pipeline, logging format) — no user preferences expressed
- Auth flow implementation details (redirect handling, token storage mechanism, middleware pattern)
- Supabase schema migration tooling choice
- Error logging format and severity levels

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- None yet. Phase 1 establishes all foundational patterns:
  - Next.js App Router routing and layout conventions
  - FastAPI router → service → model pattern
  - shadcn/ui component library integration
  - Supabase client configuration (both frontend and backend)
  - LLM Provider Protocol pattern

### Integration Points
- Supabase Auth handles Google OAuth; frontend Next.js middleware protects routes
- FastAPI JWT middleware validates Supabase tokens forwarded from frontend
- Supabase Storage for transcript file persistence (path-only in DB, signed URLs on read)
- LLM Provider abstraction connects to either Ollama (localhost:11434) or Claude API

</code_context>

<specifics>
## Specific Ideas

- All recommended options chosen — user prefers clean, modern, portfolio-grade UX patterns
- Strong preference for non-blocking flows: optional metadata, non-blocking owner resolution, bulk save
- Preview-before-commit pattern: show file preview before AI processing, show summary before saving action items
- Smart defaults over required fields: pre-fill dates, titles, and let user override rather than forcing input

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-auth-core-ai-pipeline*
*Context gathered: 2026-03-04*
