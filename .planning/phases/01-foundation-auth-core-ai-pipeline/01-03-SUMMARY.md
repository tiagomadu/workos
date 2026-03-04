---
phase: 01-foundation-auth-core-ai-pipeline
plan: "03"
subsystem: ai, api, ui
tags: [instructor, ollama, claude, anthropic, pydantic, jinja2, structured-output, background-tasks, llm-provider, protocol, accordion, editable-table]

# Dependency graph
requires:
  - phase: 01-01
    provides: FastAPI scaffold, auth middleware, config settings, database schema
  - phase: 01-02
    provides: Upload/paste endpoints, meeting CRUD, storage service, processing indicator component
provides:
  - LLM Provider Protocol with Ollama and Claude implementations
  - Instructor-based structured output (MeetingSummary, ActionItemsResult, MeetingTypeResult)
  - 3 Jinja2 prompt templates (summarize, extract actions, detect type)
  - Background processing pipeline (detect → summarize → extract → complete)
  - Meeting summary view with collapsible sections and edit mode
  - Editable action items table with bulk save
  - Meeting type badge with confidence indicator
  - Reprocess, action-items CRUD, summary update endpoints
affects: [02-entity-layer, 03-intelligence-rag]

# Tech tracking
tech-stack:
  added: [instructor, openai-async, anthropic-async]
  patterns: [Python Protocol for provider abstraction, instructor structured output, Jinja2 prompt templates, BackgroundTasks for async processing, accordion UI, inline-editable table]

key-files:
  created:
    - backend/app/ai/provider.py
    - backend/app/ai/factory.py
    - backend/app/ai/schemas.py
    - backend/app/ai/prompt_renderer.py
    - backend/app/ai/providers/ollama_provider.py
    - backend/app/ai/providers/claude_provider.py
    - backend/app/ai/prompts/summarize_meeting.j2
    - backend/app/ai/prompts/extract_action_items.j2
    - backend/app/ai/prompts/detect_meeting_type.j2
    - backend/app/services/processing.py
    - frontend/src/app/meetings/[id]/page.tsx
    - frontend/src/app/meetings/[id]/summary-view.tsx
    - frontend/src/app/meetings/[id]/summary-editor.tsx
    - frontend/src/app/meetings/[id]/action-items-table.tsx
    - frontend/src/app/meetings/[id]/meeting-type-badge.tsx
  modified:
    - backend/app/api/v1/meetings.py
    - backend/tests/conftest.py
    - frontend/src/types/meeting.ts
    - frontend/src/lib/api.ts

key-decisions:
  - "Python Protocol pattern for LLM provider abstraction — not ABC, easier testing"
  - "instructor library for structured output — works with both OpenAI and Anthropic SDKs"
  - "Ollama via AsyncOpenAI compatibility layer with JSON mode"
  - "Claude via instructor.from_anthropic() (not from_provider — more stable)"
  - "Default model: llama3.1:8b-instruct-q4_K_M for Ollama, claude-sonnet-4-20250514 for Claude"
  - "Jinja2 autoescape=False — prompts are not HTML, escaping would corrupt them"
  - "Default due date: 7 days from today for action items without extracted dates"
  - "All owner_names flagged as unresolvable in Phase 1 (people directory is Phase 2)"

patterns-established:
  - "AI providers: Python Protocol + factory pattern in app/ai/"
  - "Structured output: instructor + Pydantic response_model"
  - "Prompt management: Jinja2 templates in app/ai/prompts/"
  - "Background processing: FastAPI BackgroundTasks with status updates for polling"
  - "Processing pipeline: sequential steps with DB status tracking"
  - "Summary UI: accordion sections with toggle edit mode"
  - "Action items: inline-editable table with bulk save"

requirements-completed: [AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09, AI-10, AI-11, AI-12, AI-13, AI-14, INFRA-03, INFRA-04]

# Metrics
duration: ~8min
completed: 2026-03-04
---

# Plan 01-03: AI Processing Pipeline Summary

**LLM Provider Protocol with Ollama/Claude, instructor structured output, 3-step background pipeline, and summary/action-items UI with edit mode**

## Performance

- **Duration:** ~8 min (2 parallel task agents)
- **Completed:** 2026-03-04
- **Tasks:** 2
- **Files created/modified:** 24

## Accomplishments
- Complete LLM Provider Protocol with Ollama and Claude implementations via instructor
- 3 Jinja2 prompt templates with concrete JSON examples for reliable structured output
- Background processing pipeline: detect meeting type → generate summary → extract action items
- Each step updates meeting.status for real-time frontend polling
- Meeting detail page with collapsible summary sections (all expanded by default)
- Toggle edit mode for summary with Save/Cancel
- Editable action items table with inline editing, add/delete rows, bulk save
- Meeting type badge with confidence indicator
- Re-run processing button for reprocessing same transcript
- 34 new backend tests (schemas, prompt rendering, pipeline integration), all passing
- Error handling: failed LLM → status="failed" with error_message, transcript preserved

## Task Commits

1. **Task 1: Backend AI pipeline** — `2ac6908` (feat)
2. **Task 2: Frontend summary/action-items UI** — `2ac6908` (feat — single atomic commit)

## Files Created/Modified
- `backend/app/ai/provider.py` — LLMProvider Protocol (generate_structured, health_check)
- `backend/app/ai/factory.py` — Factory returning provider based on LLM_PROVIDER env var
- `backend/app/ai/schemas.py` — MeetingSummary, ActionItemsResult, MeetingTypeResult
- `backend/app/ai/prompt_renderer.py` — Jinja2 template renderer
- `backend/app/ai/providers/ollama_provider.py` — instructor + AsyncOpenAI, JSON mode, 120s timeout
- `backend/app/ai/providers/claude_provider.py` — instructor + AsyncAnthropic, 4096 max_tokens
- `backend/app/ai/prompts/` — 3 .j2 templates with concrete JSON examples
- `backend/app/services/processing.py` — 3-step background pipeline with error handling
- `backend/app/api/v1/meetings.py` — Added reprocess, action-items, summary endpoints + BackgroundTasks
- `frontend/src/app/meetings/[id]/page.tsx` — Meeting detail with polling + edit mode
- `frontend/src/app/meetings/[id]/summary-view.tsx` — Collapsible accordion sections
- `frontend/src/app/meetings/[id]/summary-editor.tsx` — Edit mode with 4 textareas
- `frontend/src/app/meetings/[id]/action-items-table.tsx` — Inline-editable table with bulk save
- `frontend/src/app/meetings/[id]/meeting-type-badge.tsx` — Type + confidence badge

## Decisions Made
- Python Protocol (not ABC) for LLM provider interface — simpler, better testing
- instructor for both providers — single structured output mechanism
- Jinja2 autoescape=False to prevent prompt corruption
- Default 7-day due dates for action items (from CONTEXT.md smart defaults)
- All owner_names flagged as unresolvable in Phase 1 (people directory added in Phase 2)

## Deviations from Plan
None — plan executed as specified.

## Issues Encountered
None.

## User Setup Required
None beyond Plan 01-01 setup. LLM_PROVIDER defaults to "ollama" — user should have `ollama serve` running with `llama3.1:8b-instruct-q4_K_M` pulled.

## Next Phase Readiness
- End-to-end flow proven: upload → AI processing → structured summary + action items
- Phase 1 complete — all 35 requirements (AUTH-7, INGEST-7, AI-14, INFRA-5) implemented
- Ready for Phase 2: Entity Layer (people, teams, projects, meeting linking)

---
*Phase: 01-foundation-auth-core-ai-pipeline*
*Plan: 03*
*Completed: 2026-03-04*
