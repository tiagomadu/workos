---
phase: 01-foundation-auth-core-ai-pipeline
plan: "02"
subsystem: api, ui
tags: [fastapi, nextjs, supabase-storage, transcript, upload, drag-drop, tanstack-query, polling, macwhisper, whisper-cli]

# Dependency graph
requires:
  - phase: 01-01
    provides: FastAPI scaffold, Supabase client, auth middleware, shadcn/ui, TanStack Query
provides:
  - POST /api/v1/meetings/upload endpoint (multipart .txt upload)
  - POST /api/v1/meetings/paste endpoint (JSON text body)
  - GET /api/v1/meetings/{id} endpoint (meeting status/data)
  - Transcript format detection (MacWhisper, Whisper CLI, plain)
  - Transcript normalisation (timestamp stripping)
  - Supabase Storage integration (upload, signed URLs)
  - Meeting CRUD operations (create, update status, get)
  - Frontend /meetings/new page with upload + paste tabs
  - Multi-step processing indicator with polling
affects: [01-03-ai-processing, 02-entity-layer]

# Tech tracking
tech-stack:
  added: [lucide-react]
  patterns: [multipart file upload, format detection regex, storage path convention, TanStack polling, state machine UI]

key-files:
  created:
    - backend/app/api/v1/meetings.py
    - backend/app/services/transcript.py
    - backend/app/services/storage.py
    - backend/app/models/meeting.py
    - frontend/src/app/meetings/new/page.tsx
    - frontend/src/app/meetings/new/upload-tab.tsx
    - frontend/src/app/meetings/new/paste-tab.tsx
    - frontend/src/app/meetings/new/preview-panel.tsx
    - frontend/src/app/meetings/new/metadata-form.tsx
    - frontend/src/app/meetings/new/processing-indicator.tsx
    - frontend/src/lib/api.ts
    - frontend/src/types/meeting.ts
  modified:
    - backend/app/main.py

key-decisions:
  - "Transcript storage path: {user_id}/{YYYY}/{MM}/{date}_{filename} — never signed URLs in DB"
  - "Format detection threshold: >30% of non-empty lines must match pattern"
  - "File size validation: 512000 bytes (500KB) on both client and server"
  - "Processing status polling: TanStack useQuery with 2s refetchInterval, stops on completed/failed"
  - "State machine UI: idle → preview → processing phases on single page"

patterns-established:
  - "Backend services: async functions in app/services/ wrapping Supabase operations"
  - "Backend models: Pydantic models in app/models/ for request/response schemas"
  - "Frontend API client: fetch-based functions in lib/api.ts with Bearer token"
  - "Frontend types: shared TypeScript interfaces in types/ directory"
  - "Upload validation: client-side (.txt, ≤512KB) + server-side (duplicate checks)"
  - "Processing feedback: TanStack Query polling with conditional refetchInterval"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07]

# Metrics
duration: ~6min
completed: 2026-03-04
---

# Plan 01-02: Transcript Ingestion Summary

**Upload/paste endpoints with MacWhisper/Whisper CLI normalisation, Supabase Storage, and drag-and-drop UI with polling progress indicator**

## Performance

- **Duration:** ~6 min (2 parallel task agents)
- **Completed:** 2026-03-04
- **Tasks:** 2
- **Files created:** 20

## Accomplishments
- Complete transcript ingestion pipeline: upload .txt files or paste text → normalise → store → create meeting record
- Format detection and normalisation for MacWhisper (timestamp-speaker), Whisper CLI (timestamp-bracket), and plain text
- Supabase Storage integration with path-based storage (no signed URLs in database)
- Frontend New Meeting page with drag-and-drop upload, paste textarea, file preview, metadata form
- Multi-step processing indicator with TanStack Query polling (2s interval)
- 30 new tests (22 backend + 8 frontend), all passing

## Task Commits

1. **Task 1: Backend endpoints + transcript service + storage** — `64c023a` (feat)
2. **Task 2: Frontend upload/paste UI + processing indicator** — `64c023a` (feat — single atomic commit)

## Files Created/Modified
- `backend/app/api/v1/meetings.py` — Upload, paste, and get endpoints
- `backend/app/services/transcript.py` — Format detection and normalisation
- `backend/app/services/storage.py` — Supabase Storage operations
- `backend/app/models/meeting.py` — Pydantic request/response models
- `backend/tests/test_transcript.py` — 16 normalisation tests
- `backend/tests/test_upload.py` — 7 endpoint tests with mocked storage
- `backend/tests/fixtures/` — 3 sample transcripts (plain, MacWhisper, Whisper CLI)
- `frontend/src/app/meetings/new/page.tsx` — State machine page (idle/preview/processing)
- `frontend/src/app/meetings/new/upload-tab.tsx` — Drag-and-drop with validation
- `frontend/src/app/meetings/new/paste-tab.tsx` — Textarea with validation
- `frontend/src/app/meetings/new/preview-panel.tsx` — Filename, size, first 10 lines
- `frontend/src/app/meetings/new/metadata-form.tsx` — Optional title/date/project
- `frontend/src/app/meetings/new/processing-indicator.tsx` — 4-step progress with error/retry
- `frontend/src/lib/api.ts` — API client (upload, paste, getMeeting)
- `frontend/src/types/meeting.ts` — Meeting TypeScript types
- `frontend/__tests__/lib/api.test.ts` — 8 API client tests

## Decisions Made
- Storage path convention: `{user_id}/{YYYY}/{MM}/{YYYY-MM-DD}_{filename}` for organized retrieval
- Format detection uses >30% threshold for line pattern matching
- Both client-side and server-side validation for file type and size
- State machine pattern for single-page upload flow (no route transitions during upload)

## Deviations from Plan
None — plan executed as specified.

## Issues Encountered
None.

## User Setup Required
None beyond Plan 01-01 setup (Supabase 'transcripts' storage bucket already listed there).

## Next Phase Readiness
- Ingestion pipeline complete — transcripts can be uploaded, normalised, and stored
- Meeting records created with status="pending" ready for AI processing
- Processing indicator wired with polling — Plan 01-03 wires the actual AI pipeline
- GET /api/v1/meetings/{id} ready for status updates from AI processing

---
*Phase: 01-foundation-auth-core-ai-pipeline*
*Plan: 02*
*Completed: 2026-03-04*
