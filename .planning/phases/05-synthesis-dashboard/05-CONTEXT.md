# Phase 5: Synthesis Layer - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the weekly dashboard as the default landing page and verify all performance targets. The dashboard surfaces meetings processed, open action items grouped by urgency, active project statuses, and upcoming calendar events. Performance verification confirms NFR targets are met across the full system.

Covers: DASH-01–06, INFRA-06–07

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- **2×2 grid with cards**: Top row: Meetings count metric card + Upcoming calendar events. Bottom row: Action items (wide card) + Active projects. Clean, balanced layout showing everything at a glance.

### Action Items Grouping
- **Overdue / Today / This Week / Later**: 4 sections with headers. Overdue items in red, Today in amber, This Week in neutral, Later collapsed by default. Count badges on each section header.

### Landing Page
- **Replace home page with dashboard**: The existing / route becomes the dashboard. No redirect needed — user lands directly on the dashboard after sign-in. Simplest approach.

### Performance Verification
- **Manual walkthrough + documented results**: Run the demo script manually (upload → process → search → dashboard), measure timings with browser DevTools and API logs, document results in a summary. Quick, practical, portfolio-appropriate.

### Claude's Discretion
- Dashboard card styling and visual hierarchy
- Metric calculation queries (meetings processed in 7 days)
- Calendar events widget display format
- Action item navigation (click → tracker with filter)
- Project status pill colours and icons
- Performance measurement methodology and documentation format
- Error logging review scope

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tasks API with filters (status, owner, project, sort_by) — for action items
- Projects API with get_projects (exclude archived by default) — for project statuses
- Calendar events API with get_upcoming_events (past 7 days) — for upcoming events
- Meetings table with created_at timestamps — for meetings count query
- shadcn/ui Card, Badge, Button, Table components
- React Query patterns established across all pages
- Supabase auth session token pattern

### Integration Points
- Home page (frontend/src/app/page.tsx) becomes the dashboard
- New backend endpoint: GET /api/v1/dashboard for aggregated metrics
- Uses existing endpoints: tasks, projects, calendar events
- Action item click navigates to /tasks with filter applied

</code_context>

<specifics>
## Specific Ideas

- Dashboard endpoint returns: { meetings_count, action_items: {overdue, today, this_week, later}, projects: [...], upcoming_events: [...] }
- Meetings count: COUNT(*) from meetings WHERE created_at > 7 days ago AND user_id = current
- Action items: query action_items WHERE status NOT IN (complete, cancelled) AND is_archived = false, group by due date proximity
- Projects: active projects (not archived) with status
- Calendar events: next 7 days from calendar_events
- Action item click: navigate to /tasks?status={status}&owner_id={owner}
- Dashboard uses multiple React Query hooks (one per section) for parallel loading

</specifics>

<deferred>
## Deferred Ideas

- Auto-refresh dashboard without manual reload — deferred to v2
- Meeting velocity trend chart (meetings per week over 8 weeks) — deferred to v2
- Customisable dashboard widget arrangement — deferred to v2

</deferred>

---

*Phase: 05-synthesis-dashboard*
*Context gathered: 2026-03-04*
