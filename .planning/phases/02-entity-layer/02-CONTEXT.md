# Phase 2: Entity Layer - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the people directory, team management, project tracking, master task tracker, and owner resolution pipeline. This phase adds the relational entities that turn extracted action items from raw text into linked, trackable work items with real owners, teams, and projects.

Covers: PEOPLE-01–08, PROJECTS-01–06, TASKS-01–08

</domain>

<decisions>
## Implementation Decisions

### People Directory UX

- **Searchable table**: Full directory displayed as a filterable, searchable table with columns for name, role/title, team, and action item count. Search filters across all columns. Standard data table using shadcn/ui Table component.
- **Modal dialog for creation**: "Add Person" button opens a modal dialog with name, role/title, and team assignment fields. Quick and focused — doesn't navigate away from the directory. Same pattern for "Add Team".
- **Inline team assignment**: Team membership managed directly from the people table — each person row has a team dropdown or chip that can be changed inline. No separate team membership management page needed.
- **Activity-focused profile page**: Person profile shows their name, role, team at the top, then below: all assigned action items (grouped by status), meetings they appear in, and basic stats (total items, completion rate, overdue count). Focus on what this person is responsible for.

### Owner Resolution Logic

- **Fuzzy match + confirm**: When AI extracts owner names from transcripts, use fuzzy string matching (e.g., Levenshtein distance or similar) to suggest likely matches from the people directory. Require user confirmation before linking — never auto-link ambiguous matches.
- **Inline disambiguation**: When multiple people records could match an extracted name (e.g., two "Sarah"s), show a dropdown directly on the action item letting the user pick which person. No separate resolution queue — disambiguation happens in context.
- **Simple alias field**: Each person record has an optional aliases/nicknames text field (comma-separated). Matching checks both the formal name and all aliases. e.g., "Mike" in aliases matches "Michael Chen" in formal name.
- **Post-processing step**: Owner resolution runs as a 4th step in the background processing pipeline after AI extraction completes: detect meeting type -> summarize -> extract action items -> resolve owners. Results stored with match confidence for UI display.

### Task Tracker Layout

- **Filterable table**: Master task tracker displays all action items from all meetings in a single table with column sorting and filter chips for status, assignee, project, due date, and source meeting. Uses shadcn/ui DataTable with toolbar.
- **3 statuses: To Do -> In Progress -> Done**: Simple, clean status lifecycle. Status changed via inline dropdown on each row. Minimises cognitive overhead — covers 95% of real workflows.
- **Red badge + sorted first**: Overdue tasks (past due date, not Done) get a red "Overdue" badge and sort to the top of the default view. Ensures nothing falls through the cracks. Due-today items get an amber badge.
- **Flat tasks only**: No subtasks, no dependencies, no parent-child relationships. Each action item is a standalone entity. Keeps the data model simple for Phase 2 — subtasks can be added later if needed.

### Project-Meeting Linking

- **Manual tag at upload**: User selects a project from a dropdown on the metadata form when uploading or pasting a transcript. Optional field — meetings can exist without a project link. Project assignment can also be changed later from the meeting detail page.
- **Meetings + tasks + stats on project page**: Project detail page shows: project metadata (name, description, status, owning team) at the top, then a list of linked meetings (sorted by date), aggregated task stats (open/done/overdue counts), and a filtered action items table showing only items from meetings linked to this project.
- **Active / Archived lifecycle**: Projects have two states — Active (default) and Archived. Archived projects are hidden from dropdowns and the default project list but remain accessible via an "Include archived" toggle. Simple and clean.
- **Project has one owning team**: Each project belongs to exactly one team via a foreign key. Team's project page shows all projects owned by that team. Simple relational model — no many-to-many complexity.

### Claude's Discretion

- Database migration approach for new entity tables (people, teams, projects modifications)
- API endpoint structure and Pydantic model design for CRUD operations
- Fuzzy matching algorithm choice and confidence threshold tuning
- Frontend component architecture and state management for entity forms
- Task tracker pagination strategy and default sort order
- Owner resolution confidence scoring mechanism

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn/ui Table component (used in action items table from Phase 1)
- TanStack Query patterns established for data fetching and polling
- FastAPI router -> service pattern in `app/api/v1/` and `app/services/`
- Pydantic request/response models pattern in `app/models/`
- Frontend API client in `frontend/src/lib/api.ts`
- TypeScript type definitions in `frontend/src/types/`

### Established Patterns
- Backend: FastAPI router -> service -> Supabase client (established in Phase 1)
- Frontend: Next.js App Router with page.tsx + sub-components (established in Phase 1)
- AI pipeline: BackgroundTasks with sequential steps and status updates (Phase 1)
- UI: shadcn/ui components with inline editing and bulk save (Phase 1 action items table)
- Auth: JWT middleware on backend, Supabase Auth on frontend (Phase 1)

### Integration Points
- Phase 1 action items table needs to link `owner_name` (text) to `person_id` (FK) — requires migration
- Phase 1 meetings need `project_id` FK — requires migration
- Phase 1 processing pipeline gains a 4th step (owner resolution) — extends `processing.py`
- Phase 1 meeting upload metadata form gains a project dropdown — extends `metadata-form.tsx`
- Existing `meetings` table already has columns for `meeting_type`, `summary`, `status` from Phase 1

</code_context>

<specifics>
## Specific Ideas

- All recommended options chosen — user continues to prefer clean, modern, portfolio-grade UX patterns
- Consistency with Phase 1: inline editing, bulk operations, non-blocking flows, smart defaults
- Owner resolution as pipeline step (not manual-only) — demonstrates AI-powered entity linking for portfolio
- Fuzzy matching with confirmation — balances automation with user control
- Activity-focused person profiles — practical view that answers "what is this person responsible for?"
- Simple alias field avoids ML complexity while solving 80% of name matching (Mike/Michael, Bob/Robert)

</specifics>

<deferred>
## Deferred Ideas

- Learning from corrections (auto-building alias mappings) — deferred to v2 (PEOPLE-V2-01)
- Subtasks and task dependencies — deferred, flat tasks sufficient for v1
- Multi-team project ownership — deferred, one owning team per project for v1
- AI auto-detect project from transcript content — deferred, manual linking for v1
- Kanban board view for tasks — deferred, filterable table covers v1 needs

</deferred>

---

*Phase: 02-entity-layer*
*Context gathered: 2026-03-04*
