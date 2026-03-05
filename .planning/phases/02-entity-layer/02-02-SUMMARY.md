---
phase: 02-entity-layer
plan: "02"
subsystem: api, ui
tags: [tasks, projects, tracker, filters, archive, overdue, status-lifecycle, project-linking, inline-edit, crud]

# Dependency graph
requires:
  - phase: 02-01
    provides: People/Teams CRUD, owner resolution, person profiles
provides:
  - Master task tracker with filtering, sorting, and archiving
  - Standalone task creation (not linked to meetings)
  - Project CRUD with Active/Archived lifecycle
  - Project detail page with linked meetings and aggregated task stats
  - Meeting-project linking via upload form dropdown and meeting detail
  - Overdue task detection with visual highlighting
affects: [03-intelligence-rag, 05-synthesis-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [filter chips for table filtering, inline status dropdown, overdue computation with date comparison, project-meeting FK linking, archive toggle pattern]

key-files:
  created:
    - backend/app/api/v1/tasks.py
    - backend/app/api/v1/projects.py
    - backend/app/models/task.py
    - backend/app/models/project.py
    - backend/app/services/tasks.py
    - backend/app/services/projects.py
    - backend/tests/test_tasks.py
    - backend/tests/test_projects.py
    - frontend/src/types/task.ts
    - frontend/src/types/project.ts
    - frontend/src/app/tasks/page.tsx
    - frontend/src/app/tasks/task-filters.tsx
    - frontend/src/app/tasks/task-row.tsx
    - frontend/src/app/tasks/create-task-dialog.tsx
    - frontend/src/app/projects/page.tsx
    - frontend/src/app/projects/project-dialog.tsx
    - frontend/src/app/projects/[id]/page.tsx
  modified:
    - backend/app/api/v1/meetings.py
    - backend/app/main.py
    - frontend/src/types/meeting.ts
    - frontend/src/lib/api.ts
    - frontend/src/app/meetings/new/metadata-form.tsx
    - frontend/src/app/meetings/new/page.tsx
    - frontend/src/app/meetings/[id]/page.tsx

key-decisions:
  - "3 UI statuses (To Do/In Progress/Done) mapped to DB values (not_started/in_progress/complete)"
  - "Overdue computed at query time: due_date < today AND status not in (complete, cancelled)"
  - "Default sort: overdue first, then due_date ascending"
  - "Standalone tasks have meeting_id=None, default 7-day due date"
  - "Project lifecycle: Active (on_track|at_risk|blocked) and Archived"
  - "Project-meeting linking via dropdown in upload form and meeting detail page"

patterns-established:
  - "Filter chips: Button variant toggle for table filtering"
  - "Inline status dropdown: Select onChange auto-saves"
  - "Overdue detection: date comparison with visual badge (red/amber)"
  - "Archive pattern: is_archived flag with include_archived toggle"
  - "Project linking: dropdown on upload form + change project on meeting detail"

requirements-completed: [TASKS-01, TASKS-02, TASKS-03, TASKS-04, TASKS-05, TASKS-06, TASKS-07, TASKS-08, PROJECTS-01, PROJECTS-02, PROJECTS-03, PROJECTS-04, PROJECTS-05, PROJECTS-06]

# Metrics
duration: ~10min
completed: 2026-03-04
---

# Plan 02-02: Task Tracker/Project Tracking Summary

**Master task tracker with filtering, project CRUD with detail pages, and meeting-project linking**

## Performance

- **Duration:** ~10 min (2 parallel task agents)
- **Completed:** 2026-03-04
- **Tasks:** 2
- **Files created/modified:** 24

## Accomplishments
- Master task tracker with filterable table (status, owner, project, archived)
- Overdue detection with red badge and sort-to-top
- Inline status changes via dropdown with auto-save
- Click-to-edit description with save on blur/Enter
- Standalone task creation via dialog (not linked to meetings)
- Task archiving for completed/cancelled items
- Project CRUD with Active/Archived lifecycle
- Project detail page: linked meetings, aggregated task stats (open/done/overdue)
- Meeting-project linking via upload form dropdown and meeting detail page
- 16 new backend tests (9 tasks, 7 projects), all passing
- Total: 111 backend tests, 9 frontend tests — all passing

## Task Commits

1. **Task 1: Backend task tracker and project endpoints** — `6795e91` (feat)
2. **Task 2: Frontend task tracker, project pages, and project linking** — `6795e91` (feat — single atomic commit)

## Decisions Made
- 3 UI statuses map to DB values: To Do=not_started, In Progress=in_progress, Done=complete
- Overdue computed at query time, not stored
- Default sort: overdue first, then due_date ascending
- Standalone tasks get default 7-day due date
- Project status: Active covers on_track/at_risk/blocked, Archived hides from default views

## Deviations from Plan
None — plan executed as specified.

## Issues Encountered
None.

---
*Phase: 02-entity-layer*
*Plan: 02*
*Completed: 2026-03-04*
