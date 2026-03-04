# Pitfalls Research

Research conducted for WorkOS: an AI-powered meeting transcript processor built with Next.js 14, FastAPI, Supabase (PostgreSQL + pgvector), LlamaIndex RAG, dual LLM providers (Ollama + Claude), and Google OAuth integrations. Solo developer, ~5 hrs/week.

---

## LLM INTEGRATION

---

## Unstructured LLM Output Breaking Downstream Parsers

- **What goes wrong:** The LLM returns valid-looking JSON with subtle structural variance — a missing field, a different key name, a nested array instead of a flat one, or markdown fences wrapping the JSON block. The FastAPI endpoint that parses the response throws a `ValidationError` or silently drops fields, and action items that were present in the transcript never make it into the database. This is especially common when switching between Ollama (Llama 3 8B) and Claude, because each model has different tendencies around output formatting even with identical prompts.
- **Warning signs:** Action item counts differ from what you see manually scanning the transcript. Some summaries have all fields; others are missing `follow_ups` or `decisions`. The backend logs show occasional `KeyError` or `pydantic.ValidationError` exceptions that don't always surface to the UI. Output varies noticeably when running the same transcript twice.
- **Prevention strategy:** Define Pydantic response models first and treat them as the contract. Use structured output modes where available: Claude supports `tool_use` / JSON mode for constrained output; Ollama supports `format: json` in the API request. Validate with Pydantic before writing to the database — never access dict keys directly. Add a fallback extraction layer using regex or a second LLM call if the primary parse fails. Log every raw LLM response to a debug table during development so failures are reproducible. Use Jinja2 prompt templates (already planned) and include a JSON schema or example output in the prompt itself. Test each provider independently with the same fixture transcripts before claiming provider-switch support works.
- **Which phase should address it:** Sprint 1 (core summarization). Lock this down before building the action item tracker or RAG — every downstream feature depends on reliable structured output.

---

## Prompt Drift When Switching LLM Providers

- **What goes wrong:** A prompt tuned for Claude produces excellent results, then the same prompt run against Ollama/Llama 3 8B produces hallucinated action item owners, invented due dates, or summaries that paraphrase instead of extract. The `LLM_PROVIDER` env var switch that seemed like a clean abstraction now means two separate prompt-tuning workloads. The protocol pattern hides the provider difference from application code, but the prompts themselves are not provider-agnostic.
- **Warning signs:** Acceptance criteria pass on Claude but fail on Ollama in the same sprint review. Action items reference people not in the transcript (hallucination). Due dates appear on items that had no due date mentioned. Meeting type detection flips between types on re-runs.
- **Prevention strategy:** Maintain provider-specific prompt variants inside the Jinja2 template system — e.g., `summarize_claude.j2` and `summarize_ollama.j2` with the same output schema contract. Run a fixture-based prompt regression suite (pytest with known-good transcript inputs and expected output fields) against both providers before merging any prompt change. Accept that Ollama and Claude will not produce identical outputs and define minimum acceptable quality criteria per provider, not identical criteria. For portfolio purposes, document provider differences explicitly — this is a strength, not a weakness.
- **Which phase should address it:** Sprint 1 when dual-provider support is first wired up. Revisit in Sprint 3 when RAG adds retrieved context to prompts, which amplifies provider sensitivity.

---

## Hallucinated People, Dates, and Project Names

- **What goes wrong:** Llama 3 8B in particular will invent plausible-sounding names, roles, or project names when the transcript is ambiguous, short, or refers to people by first name only. An action item gets assigned to "Sarah" when the transcript mentions "Sarah from the London team" — and the model creates a new person record instead of matching the existing one. Over time the people directory fills with duplicates and ghost records.
- **Warning signs:** People directory grows faster than the number of real team members in the system. Action items reference owners not found in the people table. Project names in extracted summaries don't match any project in the tracker.
- **Prevention strategy:** Pass the current people directory and project list as context in the summarization prompt (a lightweight form of RAG). Instruct the model explicitly: "Only assign action items to people whose full name appears in the provided roster. If no match, set owner to null." Add a post-processing validation step that checks extracted names against the people table and flags mismatches for human review rather than auto-creating records. Never auto-create people or project records from LLM output without a confirmation step in the UI.
- **Which phase should address it:** Sprint 2 (people and project entity linking). Do not auto-link in Sprint 1 — manual review is acceptable early.

---

## Ollama Timeout and Resource Contention on Apple Silicon

- **What goes wrong:** Llama 3 8B on a 16GB Apple Silicon machine is memory-constrained. When Docker is running Supabase locally alongside Ollama and a Next.js dev server, the model runs in degraded mode (CPU fallback instead of Metal GPU acceleration) or takes 4-6 minutes per transcript instead of the target under 2 minutes. Alternatively, Ollama times out mid-generation on long transcripts, leaving a partial response that breaks the JSON parser.
- **Warning signs:** Summarization times creep above 2 minutes consistently. `ollama ps` shows the model is not loaded in VRAM. Docker stats show memory pressure during inference. Partial JSON responses in backend logs.
- **Prevention strategy:** Set Ollama to run natively (not in Docker) on the host machine and expose it to the Docker network via `host.docker.internal`. Configure FastAPI with a per-request timeout (e.g., 180 seconds) that returns a graceful error rather than hanging. Implement streaming LLM responses so the UI shows progress rather than a blank wait. For long transcripts, chunk and summarize in sections before combining — test transcript length limits for each provider early. Document the recommended local dev setup (Ollama native + Docker for Supabase) explicitly.
- **Which phase should address it:** Sprint 0 / Sprint 1 environment setup. This is infrastructure, not a feature — resolve it before Sprint 1 acceptance testing.

---

## RAG SYSTEMS

---

## Chunking Strategy Mismatched to Meeting Transcript Structure

- **What goes wrong:** The default LlamaIndex chunking strategy (fixed token windows, e.g., 512 tokens with 50-token overlap) cuts meeting transcripts at arbitrary points — mid-speaker-turn, mid-decision, mid-action-item. Retrieved chunks in RAG queries return fragments that lack the context needed for the LLM to answer questions like "What did we decide about the vendor contract in the Q3 review?" The retrieved chunk contains the decision but not the topic it refers to, because the topic heading was in the previous chunk.
- **Warning signs:** RAG answers are vague or require multiple follow-up questions to get useful detail. Source citations point to chunks that don't seem relevant to the answer. Precision is poor — retrieved chunks match the query keyword but not the intent.
- **Prevention strategy:** Use semantic or structural chunking, not fixed token windows. Meeting transcripts have natural structure: speaker turns, agenda items, decisions, action items. Parse this structure during ingestion and chunk along those boundaries. Store metadata per chunk: meeting ID, meeting date, chunk type (decision / action item / discussion), speaker if attributable. Use this metadata as pre-filters in pgvector queries (e.g., filter `chunk_type = 'decision'` before vector similarity search). LlamaIndex supports custom node parsers — implement a `MeetingTranscriptNodeParser` as a first-class component, not an afterthought.
- **Which phase should address it:** Sprint 4 (RAG implementation). Chunking strategy must be decided before indexing any real data — re-indexing everything after choosing a better strategy is costly.

---

## Embedding Dimension Mismatch After Provider Switch

- **What goes wrong:** The project correctly chose 768-dim embeddings with `nomic-embed-text` to avoid re-indexing when switching providers. However, if any component generates embeddings with a different model — a LlamaIndex default, a test using OpenAI `text-embedding-ada-002` (1536 dims), or a future experiment — those vectors land in the same `pgvector` column and break all similarity queries silently. pgvector does not enforce dimension consistency at the column level by default in older configurations.
- **Warning signs:** RAG search returns nonsensical results or ranks irrelevant documents first. `SELECT embedding <-> query_vector FROM chunks` returns distances that don't correlate with relevance. pgvector logs show dimension mismatch errors that aren't surfaced to the application.
- **Prevention strategy:** Set the vector column dimension explicitly in the schema: `embedding vector(768)` — pgvector will then enforce it at write time and reject mismatched insertions. Add a guard in the FastAPI embedding service that asserts `len(embedding) == 768` before any database write. Never let LlamaIndex choose the embedding model implicitly — always instantiate the embed model explicitly in code. If experimentation requires a different embedding model, use a separate table or index.
- **Which phase should address it:** Sprint 0 database schema design. Enforce this at DDL level before any data is written.

---

## Retrieval Relevance Degradation on Short or Generic Queries

- **What goes wrong:** Semantic search works well for specific queries ("what did we decide about the onboarding timeline") but returns poor results for short or vague queries ("meetings about Sarah", "recent project updates"). The embedding of a short query has high variance and cosine similarity scores become unreliable at low specificity. The user gets results that match on surface keywords rather than semantic meaning.
- **Warning signs:** RAG answers for specific queries are good but vague queries return unrelated meetings. Users (even in solo testing) find themselves rephrasing queries multiple times. Top-k retrieved chunks have similarity scores clustered near 0.5 — no clear winner.
- **Prevention strategy:** Implement hybrid search: combine pgvector cosine similarity with PostgreSQL full-text search (`tsvector`) using reciprocal rank fusion. Supabase supports both natively. Add query expansion — use the LLM to rewrite the user's query into a more specific semantic form before embedding it. Set a minimum similarity threshold (e.g., 0.75) and return a "no confident results found" message rather than surfacing low-confidence chunks. For entity-based queries ("meetings about Sarah"), route through the structured database (JOIN meetings -> action_items -> people) rather than vector search — not everything needs RAG.
- **Which phase should address it:** Sprint 4 (initial RAG) and Sprint 5 (search quality tuning). Get basic retrieval working first, then add hybrid search in the next sprint.

---

## pgvector Index Not Used Due to Missing HNSW Configuration

- **What goes wrong:** pgvector supports two index types: IVFFlat and HNSW. Without explicit index creation, every vector similarity query performs a sequential scan — acceptable for 100 rows, completely unusable at 10,000+ chunks. IVFFlat requires tuning `lists` based on dataset size (typically `sqrt(num_rows)`) and must be rebuilt after significant data growth. HNSW is better for this use case but requires more memory. A common mistake is creating the index on an empty table (which does nothing useful for IVFFlat) or using default parameters that don't match the dataset size.
- **Warning signs:** RAG query latency is acceptable early in development but grows linearly as more meetings are indexed. `EXPLAIN ANALYZE` on vector queries shows `Seq Scan` instead of `Index Scan`. Query times exceed the 5-second target with 500+ indexed meetings.
- **Prevention strategy:** Use HNSW index for this workload (`CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)`). Create the index after an initial data load of representative size, not on an empty table. Run `EXPLAIN ANALYZE` on vector queries as part of Sprint 4 acceptance criteria. Set `pgvector.hnsw_ef_search` appropriately (start with 40, tune from there). Document the index creation as a required migration step, not an optional optimization.
- **Which phase should address it:** Sprint 4 database setup. Include pgvector index validation as an explicit acceptance criterion.

---

## NEXT.JS + FASTAPI INTEGRATION

---

## CORS Misconfiguration Blocking API Calls in Production

- **What goes wrong:** During local development, FastAPI runs on `localhost:8000` and Next.js on `localhost:3000`. CORS is configured with `allow_origins=["http://localhost:3000"]`. This works locally. In production (or staging with a real domain), the origin is `https://app.workos.example.com` and requests are blocked. Alternatively, a developer sets `allow_origins=["*"]` to stop the CORS errors during development and forgets to tighten it before shipping — credentials and cookies then break because `allow_credentials=True` is incompatible with wildcard origins.
- **Warning signs:** Browser console shows `CORS policy: No 'Access-Control-Allow-Origin' header` on API calls. Auth token is not forwarded. API calls work in Swagger UI or Postman (no CORS enforcement) but fail in the browser. `allow_credentials` + `allow_origins=["*"]` causes a runtime error in newer FastAPI/Starlette versions.
- **Prevention strategy:** Drive CORS origins from an environment variable (`ALLOWED_ORIGINS=http://localhost:3000,https://staging.workos.example.com`) parsed as a list at startup. Never hardcode origins and never use wildcard with credentials. Test CORS explicitly with a browser-based integration test, not just curl or Postman. Use the same Docker network for local dev so service discovery uses container names rather than localhost, which avoids some CORS issues entirely.
- **Which phase should address it:** Sprint 1 when the Next.js frontend first calls the FastAPI backend. Do not defer — CORS bugs discovered late cause multi-hour debugging sessions.

---

## Auth Token Not Forwarded from Next.js SSR to FastAPI

- **What goes wrong:** Supabase Auth issues a JWT that lives in the browser's `localStorage` or a cookie. When Next.js renders a page server-side (SSR), the server component has no access to the browser's `localStorage`. The SSR component makes a fetch to FastAPI without an `Authorization` header, FastAPI's dependency sees no token and returns 401, and the user sees a blank or error page despite being logged in. This is a fundamental architectural confusion between where auth state lives in Next.js 14 App Router.
- **Warning signs:** Pages that fetch protected API data show errors or loading spinners on initial load but work after a client-side navigation. Server component logs show 401 responses from FastAPI. Auth works perfectly in client components but breaks in server components.
- **Prevention strategy:** Establish a clear rule at the start: FastAPI data fetching happens in client components or through Next.js API route handlers (which can access cookies server-side). If SSR is required for a specific route, use Next.js API routes as a proxy that reads the Supabase session cookie, extracts the JWT, and forwards it to FastAPI. Use `@supabase/ssr` (the official SSR package) for cookie-based session management instead of `localStorage`. Document this pattern in a `ARCHITECTURE_DECISIONS.md` entry before Sprint 1 so it doesn't get re-decided ad hoc per component.
- **Which phase should address it:** Sprint 1 auth setup. This decision shapes every data-fetching component written afterward.

---

## SSR / CSR Data Fetching Inconsistency Across Pages

- **What goes wrong:** Early pages are built as server components with direct Supabase queries (fast, SEO-friendly). Later pages are built as client components using `useEffect` + fetch to FastAPI (because they need the JWT). The app becomes a hybrid with no consistent pattern — some pages flicker (CSR), some have stale data (SSR without revalidation), and debugging requires knowing which rendering model each page uses. This is especially painful for the dashboard, which aggregates data from multiple sources.
- **Warning signs:** The dashboard shows stale meeting counts until a hard refresh. Some pages have loading states; others don't. Bug reports are hard to reproduce because the issue depends on navigation path (SSR vs CSR hydration). Data between related pages is inconsistent.
- **Prevention strategy:** Choose one primary data fetching pattern for the project and document it. Recommended for this stack: client-side fetching via React Query (or SWR) to FastAPI for all AI-processed data, and Next.js server components only for public/static content. This gives consistent caching, loading states, and error handling. React Query's `useQuery` integrates cleanly with Supabase Auth token injection via an Axios interceptor. Establish this pattern in Sprint 1 with a reference implementation component before building Sprint 2+ features.
- **Which phase should address it:** Sprint 1 architecture foundation. Inconsistency here compounds with every new page added.

---

## SUPABASE

---

## RLS Policies Blocking Queries in Ways That Look Like Missing Data

- **What goes wrong:** Row Level Security is enabled on all tables (correct for production). A query returns an empty array instead of throwing an error when RLS denies access. The developer assumes no data exists, adds seed data, still gets empty arrays, and spends hours debugging data issues before realizing the JWT is missing from the Supabase client request — so RLS evaluates `auth.uid()` as null and the policy denies every row. This happens most often when backend Python code uses the Supabase service role key (bypasses RLS) during development, creating a false sense of security.
- **Warning signs:** Frontend shows empty tables despite data existing in the Supabase dashboard. Queries return `[]` with no error. The same query works when run in the Supabase SQL editor (which uses the service role) but not from the app. RLS policies pass unit tests using the service key but fail in integration.
- **Prevention strategy:** Never use the service role key in FastAPI for queries that should be user-scoped. Use the anon key with the user's JWT forwarded in the `Authorization` header: `supabase.auth.set_session(access_token, refresh_token)`. Add a `SELECT current_setting('request.jwt.claims', true)` query to a health check endpoint to verify RLS context is set correctly. Write RLS policies that explicitly handle the null uid case. Test RLS policies using `SET LOCAL role = anon; SET LOCAL request.jwt.claims = '{"sub": "<test_user_id>"}';` in a SQL test script — not just by running queries as the service role.
- **Which phase should address it:** Sprint 1 auth integration and Sprint 2 when multi-table queries are first built. RLS correctness must be validated before any data is considered trustworthy.

---

## pgvector Extension Not Enabled on Supabase Project

- **What goes wrong:** pgvector is not enabled by default on all Supabase tiers. A developer writes migrations assuming it exists, runs them, and gets `ERROR: type "vector" does not exist`. On Supabase Free tier, pgvector must be enabled explicitly via the dashboard (Database > Extensions). Additionally, the `vector` column type is not recognized by some ORMs and migration tools unless explicitly handled — a migration that works in local Postgres with pgvector may fail in CI against a Supabase project without the extension.
- **Warning signs:** Migration fails with `type "vector" does not exist`. LlamaIndex indexing fails with a database error on first run. CI pipeline passes but deployment fails.
- **Prevention strategy:** Add `CREATE EXTENSION IF NOT EXISTS vector;` as the first statement in the initial migration file. Verify pgvector is enabled in the Supabase project dashboard before running migrations. In CI, provision a Supabase local dev stack (`supabase start`) which includes pgvector, or use a Docker PostgreSQL image with pgvector pre-installed. Document pgvector enablement as Step 1 of the setup guide.
- **Which phase should address it:** Sprint 0 / database initialization. This is a prerequisite, not a feature.

---

## Supabase Storage Signed URL Expiry Causing Broken Transcript Access

- **What goes wrong:** Meeting transcripts are uploaded to Supabase Storage and referenced in the database by their storage path. Signed URLs are generated at upload time with a default expiry (e.g., 1 hour or 1 day). The application stores the signed URL in the database instead of the storage path. After expiry, all transcript links are broken and re-processing a meeting fails because the source file is "not found." This is a subtle but database-corrupting bug.
- **Warning signs:** Re-processing an old meeting fails with a 404 on the transcript file. Transcript preview links in the UI return "Access Denied" after 24 hours. Storage bucket shows files exist but URLs are dead.
- **Prevention strategy:** Store only the storage path (e.g., `transcripts/2026/meeting-123.txt`) in the database, never the signed URL. Generate signed URLs on demand at read time using the Supabase Storage API with an appropriate short expiry (e.g., 15 minutes for download, 1 minute for preview). Treat signed URLs as ephemeral rendering artifacts, not persistent references. Add a database constraint or application-level validation that rejects any value in the `storage_path` column that starts with `https://`.
- **Which phase should address it:** Sprint 1 file upload implementation. This is a design decision made once — fix it at the point of first upload, not after data is in the database.

---

## OAuth Token Refresh Failing After Long Sessions

- **What goes wrong:** Supabase Auth handles Google OAuth token refresh automatically for the Supabase session (the JWT used to query Supabase). However, the Google OAuth access token used to call Google Calendar and Gmail APIs is separate from the Supabase session token. Google OAuth tokens expire in 1 hour. If the application stores the Google access token but not the refresh token, or if the refresh token is rotated (Google's default policy for unverified apps), all Google API calls silently fail after the first hour. The user sees "No events" or "No emails" without a meaningful error.
- **Warning signs:** Google Calendar/Gmail integrations work on first connection but fail after an hour without any user action. Error logs show 401 responses from Google APIs. The Supabase session is still valid (user is still logged in) but Google API calls fail. The issue only appears in testing that spans more than 1 hour.
- **Prevention strategy:** Store the Google refresh token in Supabase (encrypted, in a secure column or Supabase Vault). On every Google API call, check token expiry before the call and proactively refresh using the stored refresh token if within 5 minutes of expiry. Implement an exponential backoff retry with token refresh on 401 responses from Google APIs. During OAuth consent, explicitly request `access_type=offline` and `prompt=consent` to guarantee a refresh token is issued — Google only issues a refresh token on first consent unless `prompt=consent` forces re-consent. Test the full token refresh cycle by advancing the system clock or manually expiring the token in testing.
- **Which phase should address it:** Sprint 5 (Google integrations). Token refresh must be implemented in the same sprint as the Google API integration, not deferred to a polish sprint.

---

## GOOGLE API INTEGRATION

---

## Requesting Overly Broad OAuth Scopes Triggering Manual Review

- **What goes wrong:** The Google Calendar and Gmail integrations need read-only access. If the OAuth consent screen requests `https://www.googleapis.com/auth/gmail.modify` (because it seemed close enough) instead of `https://www.googleapis.com/auth/gmail.readonly`, Google classifies the app as requesting sensitive scopes and flags it for manual verification review — a process that takes weeks and requires a privacy policy, a demo video, and organizational verification. The same applies to requesting `https://www.googleapis.com/auth/calendar` (full access) instead of `https://www.googleapis.com/auth/calendar.readonly`.
- **Warning signs:** Google OAuth consent screen shows a "This app isn't verified" warning. Users see a scary interstitial blocking consent. App submission is flagged as requiring extended verification. Google rejects the OAuth app registration.
- **Prevention strategy:** Use the minimum possible scopes: `https://www.googleapis.com/auth/calendar.readonly` and `https://www.googleapis.com/auth/gmail.readonly`. Audit scope usage before submitting for any verification. For a portfolio/personal-use app, "Testing" mode (up to 100 test users) avoids the verification requirement entirely — document this as the intended deployment model. Never add broader scopes speculatively "for future use." List the exact scopes being requested in the consent screen's justification field with a one-line explanation of why each is needed.
- **Which phase should address it:** Sprint 0 Google Cloud project setup, before writing a single line of API integration code. Scope decisions are architectural and hard to change after OAuth is wired.

---

## Google Rate Limits on Gmail API During Batch Import

- **What goes wrong:** The Gmail import feature reads emails and imports them as meeting transcripts. A naive implementation calls the Gmail API once per email in a loop — `users.messages.get` for each message ID returned by `users.messages.list`. Gmail's API has a quota of 250 "units" per user per second, where `messages.get` costs 5 units. A loop of 50 emails hits the rate limit in under 1 second and starts receiving 429 responses. The application retries immediately (no backoff), hammers the API further, and either crashes or takes 10+ minutes to import a small batch.
- **Warning signs:** Gmail import works for 1-2 emails but hangs or fails for larger batches. Google API logs show 429 responses. Import completion time is non-linear with batch size — 10 emails takes 10x longer than 1 email.
- **Prevention strategy:** Use the Gmail Batch API (`POST https://www.googleapis.com/batch/gmail/v1`) to combine up to 100 message fetch requests into a single HTTP call, reducing both latency and quota consumption. Implement exponential backoff with jitter on 429 and 503 responses (the Google API Python client library has built-in retry logic via `googleapiclient.discovery` — enable it). Add per-user rate limit tracking in the application layer. For the portfolio use case (single user, 5-15 meetings/week), quota limits are unlikely to be hit in practice — but demonstrate awareness by implementing proper backoff and documenting quota limits.
- **Which phase should address it:** Sprint 5 Gmail integration. Design batch import with rate limiting from the start.

---

## Consent Screen Not Configured for Calendar + Gmail on Same OAuth Client

- **What goes wrong:** Supabase Google Auth uses an OAuth client for login. The same client can be extended to request Calendar and Gmail scopes, or a separate OAuth client can be used. A common mistake is creating a second OAuth client for Calendar/Gmail and running two separate OAuth flows — the user sees two consent screens and grants separate permissions that are stored in different places. Alternatively, the Calendar/Gmail scopes are added to the Supabase OAuth client but Supabase does not surface the extra tokens (it only manages the session token, not raw Google tokens), so the application has no access to the Calendar/Gmail access token at all.
- **Warning signs:** User authenticates successfully with Supabase but Calendar/Gmail API calls return 401. The Supabase session has no Google access token or it doesn't have Calendar scope. Two separate consent popups appear during login.
- **Prevention strategy:** Implement Google Calendar/Gmail OAuth as a separate, explicit "Connect Google" flow using the Google OAuth2 client library directly (not through Supabase). This flow requests the read-only calendar and Gmail scopes, receives a proper access token + refresh token, and stores them in the Supabase database linked to the user's account. Keep Supabase Auth (via its Google provider) strictly for login identity — do not try to extract Google API tokens from the Supabase session. The two flows share the same Google Cloud OAuth client ID but are logically separate: one for identity, one for API access. This is the recommended pattern in Google's documentation.
- **Which phase should address it:** Sprint 5 design, before any Google API code is written. This is an architectural decision, not an implementation detail.

---

## SOLO DEVELOPER

---

## Scope Creep From "While I'm Here" Feature Additions

- **What goes wrong:** While implementing meeting type detection (a scoped feature), the developer notices that the transcript also contains sentiment data and adds sentiment analysis. While building the action item tracker, they add priority scoring. While wiring Google Calendar sync, they add calendar event creation (explicitly out of scope). Each addition seems small in isolation. After 3 sprints, the backlog has grown instead of shrinking, no feature is fully polished, and the portfolio project looks like a pile of half-finished ideas instead of a coherent demonstration.
- **Warning signs:** Sprint reviews show more features "in progress" than "complete." New issues are created faster than old ones are closed. The `Out of Scope` list in PROJECT.md is being quietly violated. Features are "80% done" for multiple consecutive sprints. The demo script requires caveats ("this part isn't working yet but...").
- **Prevention strategy:** Treat the `Out of Scope` section of PROJECT.md as a written contract. When a new idea surfaces, add it to a `FUTURE.md` parking lot file — never directly to the active backlog. Conduct a strict 5-minute scope check at the start of every coding session: "What is the one thing I'm building today?" Apply the Definition of Done (already written) as a gate — a feature is not complete until it meets all its acceptance criteria, and incomplete features are not worth starting new work. At 5 hours/week, one unscoped feature costs an entire sprint.
- **Which phase should address it:** Ongoing, starting Sprint 1. Most damaging in Sprints 3-5 when the project feels "almost done" and additions seem cheap.

---

## Over-Engineering Infrastructure Before Core Features Exist

- **What goes wrong:** Before any feature is working end-to-end, the developer spends 2-3 sprints building: a comprehensive Docker Compose setup with health checks, a CI/CD pipeline with matrix testing across Python versions, a full observability stack with structured logging, a complete error handling framework with custom exception types, and a provider abstraction layer with 4 LLM providers when only 2 are planned. The infrastructure is impressive but the application processes zero transcripts. A portfolio reviewer sees no working demo.
- **Warning signs:** Sprint 0 runs over by 2-3 weeks. The GitHub repo has excellent infrastructure code but no UI. Commits are to `docker/`, `ci/`, `logging/` but not to `features/`. The developer can explain the architecture in detail but cannot demo a user flow.
- **Prevention strategy:** Sprint 0 should produce exactly one thing: a vertical slice that processes one transcript end-to-end (paste text, get summary, see it in a UI). Everything else — perfect Docker setup, CI/CD, observability — is scaffolding built around working features, not before them. Use "walking skeleton" as the guiding metaphor: the thinnest possible thing that moves end-to-end. Infrastructure improvements are backlog items, not prerequisites. Accept ugly infrastructure in Sprint 0-1 (hardcoded config, no CI) and replace it progressively. The portfolio audience cares about working AI features, not Docker Compose sophistication.
- **Which phase should address it:** Sprint 0 scoping. The Sprint 0 plan (already written) should have a single acceptance criterion: can the system process one transcript end-to-end?

---

## Burnout and Invisible Progress at 5 Hours Per Week

- **What goes wrong:** At 5 hours/week, a 2-week sprint is 10 hours of work. A single complex feature (e.g., RAG with hybrid search, pgvector indexing, and a working search UI) takes 15-20 hours. The developer estimates it will fit in one sprint, it doesn't, it rolls over, and after 2-3 sprints of a feature that "isn't done yet" the project feels like it's going nowhere. Motivation drops. Sessions get shorter. The project stalls at 60% completion — the worst place for a portfolio piece.
- **Warning signs:** Sprint retrospectives note features rolling over for the second consecutive time. Coding sessions get shorter or more distracted. The developer spends more time reading about the technology than building with it. GitHub commit frequency drops. The project timeline on the portfolio says "in progress" for 4+ months.
- **Prevention strategy:** Calibrate sprint scope to 8 hours of effective work (not 10) — accounting for context switching, debugging time, and the reality that solo dev time is inefficient. Break features into 2-3 hour sub-tasks so every session ends with something committed and working. Create a `PROGRESS.md` that lists what's demonstrably working — not planned, not in progress, but actually done. Update it every session. Make progress visible to yourself. Set a "shippable" milestone at the midpoint of the project (e.g., after Sprint 3) where the core loop works even if RAG and Google integrations aren't done — this gives a safety net if later sprints slip. Celebrate small wins explicitly.
- **Which phase should address it:** Sprint planning, every sprint. Most critical in Sprints 4-6 when the "hard parts" (RAG, Google OAuth) hit and motivation is naturally lowest.

---

## Neglecting the Demo Path While Building Features

- **What goes wrong:** Each feature is built and tested via the FastAPI Swagger UI or direct API calls. The Next.js UI exists but is incomplete — tables with no data, forms that don't connect to the API, navigation that leads to placeholder pages. When it's time to record a portfolio demo video, the developer realizes the UI needs 20+ hours of polish work that was never scheduled. Alternatively, the demo path (upload transcript -> view summary -> see action items -> search history) works but is awkward, requires multiple steps, and doesn't tell a coherent story.
- **Warning signs:** Swagger UI is heavily used during development but the Next.js app is rarely opened. UI components are started but not connected to real data. The acceptance criteria focus on API behavior (response schema, status codes) but not UI completeness. No demo script exists.
- **Prevention strategy:** Write the demo script before Sprint 1 starts: a 3-minute walkthrough of the core user story (upload transcript, review summary, find action item, search history). Every sprint's acceptance criteria should include "the demo script works end-to-end." Build UI components alongside API endpoints, not after. The portfolio presentation is the product — treat the demo experience as a first-class requirement, not a finishing step.
- **Which phase should address it:** Sprint 0 (write the demo script). Validate the demo path at every sprint review.

---

*Research conducted 2026-03-04. Specific to WorkOS stack: Next.js 14 App Router, FastAPI, Supabase, LlamaIndex, Ollama + Claude, Google OAuth.*
