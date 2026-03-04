# Phase 1 Research: Foundation + Auth + Core AI Pipeline

**Researched:** 2026-03-04

---

## 1. Next.js 15 App Router + Supabase Auth Setup

### Key Findings

- **`@supabase/ssr` v0.9.0** is the current package for Next.js App Router SSR auth (replaces deprecated `@supabase/auth-helpers-nextjs`). Paired with `@supabase/supabase-js` v2.x.
- The SSR package exports two factory functions: `createBrowserClient` (client components) and `createServerClient` (server components, route handlers, middleware).
- Session is stored in **cookies** (not localStorage). The middleware refreshes the auth token on every request by calling `supabase.auth.getUser()` and writing updated cookies to the response.
- Next.js 15 made `cookies()` async — the server client utility must `await cookies()` before passing to `createServerClient`.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the two required env vars on the frontend.

### Recommended Approach

**1. Install packages:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**2. Create `lib/supabase/client.ts` (browser client for client components):**
```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**3. Create `lib/supabase/server.ts` (server client for server components/route handlers):**
```typescript
import "server-only"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Swallow when called from a Server Component (read-only cookies)
          }
        },
      },
    }
  )
}
```

**4. Create `middleware.ts` at project root:**
```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith("/login") &&
      !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

**5. Google OAuth callback at `app/auth/callback/route.ts`:**
```typescript
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

**6. Sign-in action (server action or client-side):**
```typescript
const supabase = createClient()
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${origin}/auth/callback`,
    queryParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
})
// Redirect to data.url
```

**7. Sign-out:**
```typescript
await supabase.auth.signOut()
```

### Pitfalls to Avoid
- **Do NOT use `@supabase/auth-helpers-nextjs`** — it is deprecated. Only use `@supabase/ssr`.
- **`cookies()` is async in Next.js 15** — forgetting `await` causes runtime errors.
- **Server Components cannot write cookies** — the try/catch in `setAll` is intentional. Session refresh happens in middleware, not in server components.
- **Always call `supabase.auth.getUser()` in middleware** (not `getSession()`). `getUser()` validates the token server-side; `getSession()` only reads from the cookie without validation.
- **Add `http://localhost:3000/auth/callback` to Supabase Auth redirect allow list** in the dashboard under Authentication > URL Configuration.
- **Request `access_type=offline` and `prompt=consent`** in the OAuth params to guarantee a refresh token is issued by Google.

---

## 2. FastAPI + Supabase JWT Middleware

### Key Findings

- Supabase JWTs use **HS256** algorithm with the project's JWT secret (found under Settings > API > JWT Secret in the Supabase dashboard).
- The JWT `aud` claim is `"authenticated"` — this MUST be passed as the `audience` parameter when decoding. Omitting it causes silent decode failures.
- **PyJWT** (`pyjwt>=2.9.0`) is recommended over `python-jose` — python-jose is barely maintained and has known security issues. PyJWT is more actively maintained.
- FastAPI's `Depends()` system is the correct injection mechanism for auth context.
- FastAPI never issues JWTs — it only validates JWTs issued by Supabase.

### Recommended Approach

**1. Install:**
```bash
pip install pyjwt[crypto]>=2.9.0
```

**2. Create `app/core/auth.py`:**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel

from app.core.config import settings

security = HTTPBearer()


class AuthenticatedUser(BaseModel):
    id: str        # Supabase user UUID (from "sub" claim)
    email: str
    role: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return AuthenticatedUser(
            id=payload["sub"],
            email=payload.get("email", ""),
            role=payload.get("role", "authenticated"),
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
```

**3. Use in route handlers:**
```python
from app.core.auth import AuthenticatedUser, get_current_user

@router.post("/meetings/upload")
async def upload_transcript(
    file: UploadFile,
    user: AuthenticatedUser = Depends(get_current_user),
):
    # user.id is the Supabase user UUID
    # Use it for storage paths, DB queries, etc.
    ...
```

### Pitfalls to Avoid
- **Never use the Supabase service role key for user-scoped queries.** Always forward the user's JWT.
- **Always validate the `audience` claim** as `"authenticated"`. Without this, the decode silently fails or returns incorrect data.
- **PyJWT's `decode()` raises different exception types** — catch `jwt.ExpiredSignatureError` separately from `jwt.InvalidTokenError` for better error messages.
- **Do not call Supabase's remote verification endpoint** (600ms round trip). Local JWT decode with the shared secret is sufficient and much faster.

---

## 3. Docker Compose for Local Dev

### Key Findings

- **Ollama MUST run natively on macOS** (not in Docker) to access Metal GPU acceleration. Running in Docker falls back to CPU, making Llama 3.1 8B 2-3x slower.
- Docker services reach the host machine via `host.docker.internal` (built into Docker Desktop for Mac).
- Volume mounts with `./backend:/app` enable hot reload for FastAPI via `uvicorn --reload`.
- Volume mounts with `./frontend:/app` enable hot reload for Next.js, but `node_modules` must be excluded via an anonymous volume to prevent platform-mismatch issues.
- Supabase Cloud free tier is used for the database — no local Supabase containers needed.

### Recommended Approach

```yaml
# docker-compose.yml
version: "3.8"

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules          # Anonymous volume for node_modules
      - /app/.next                 # Anonymous volume for .next cache
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - LLM_PROVIDER=${LLM_PROVIDER:-ollama}
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - ALLOWED_ORIGINS=http://localhost:3000
    extra_hosts:
      - "host.docker.internal:host-gateway"
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Backend `Dockerfile.dev`:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Frontend `Dockerfile.dev`:**
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]
```

### Pitfalls to Avoid
- **`extra_hosts` directive** is needed on Linux for `host.docker.internal`. On macOS Docker Desktop it works automatically, but adding it ensures cross-platform compatibility.
- **Anonymous volumes for `node_modules` and `.next`** prevent the host mount from overwriting container-installed dependencies. Without this, `npm ci` inside the container is useless.
- **Ollama must be started separately** before `docker-compose up`. Document this: `ollama serve` in a separate terminal, then `ollama pull llama3.1:8b-instruct-q4_K_M`.
- **Do NOT add an Ollama service to docker-compose** — this is intentional, not a gap. The README must explain that Ollama runs on the host for Metal GPU access.
- **`.env` file** at the repo root is loaded automatically by Docker Compose. Provide `.env.example` with all keys documented.

---

## 4. Supabase Schema + Migrations

### Key Findings

- **pgvector must be enabled explicitly** via `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;` as the first statement in the initial migration.
- **Supabase CLI** (`supabase migration new <name>`) is the recommended migration tool. It generates timestamped SQL files in `supabase/migrations/`.
- Vector column dimensions are enforced at DDL level: `embedding vector(768)` rejects mismatched dimensions at write time.
- RLS (Row Level Security) for a single-user app should use `auth.uid()` to scope all policies to the authenticated user.
- PostgreSQL triggers for `updated_at` are the correct pattern — never update this field in application code.

### Recommended Approach

**1. Install Supabase CLI:**
```bash
npm install -g supabase
supabase init   # Creates supabase/ directory
supabase link --project-ref <project-id>
```

**2. Create initial migration (`supabase/migrations/00001_init.sql`):**
```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Meetings table
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    meeting_date TIMESTAMPTZ,
    meeting_type TEXT,
    meeting_type_confidence TEXT,
    transcript_path TEXT,              -- Supabase Storage path (never signed URL)
    raw_transcript TEXT,
    summary JSONB,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Action items table
CREATE TABLE action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    owner_name TEXT,                   -- Raw extracted name
    owner_id UUID REFERENCES people(id) ON DELETE SET NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'not_started',  -- not_started | in_progress | complete | cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_action_items_updated_at
    BEFORE UPDATE ON action_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- People table (needed for owner_id FK, fully built in Phase 2)
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    team_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Teams table (stub for Phase 2)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lead_id UUID REFERENCES people(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE people ADD CONSTRAINT fk_people_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Projects table (stub for Phase 2)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'on_track',  -- on_track | at_risk | blocked | complete
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Meeting-project link
ALTER TABLE meetings ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Document embeddings (for RAG in Phase 3)
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,         -- 'transcript' | 'summary'
    source_id UUID NOT NULL,           -- meeting UUID
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast ANN search (created now, used in Phase 3)
CREATE INDEX ON document_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Calendar events (stub for Phase 4)
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_event_id TEXT,
    title TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    attendees JSONB,
    meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activity log
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_meetings_status ON meetings(user_id, status);
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_user_status ON action_items(user_id, status, due_date);
CREATE INDEX idx_people_user_id ON people(user_id);
CREATE INDEX idx_document_embeddings_source ON document_embeddings(source_type, source_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- RLS policies (single-user, all scoped to auth.uid())
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Generic RLS pattern: user can do everything with their own data
CREATE POLICY "Users can select own meetings" ON meetings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meetings" ON meetings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meetings" ON meetings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meetings" ON meetings
    FOR DELETE USING (auth.uid() = user_id);

-- Repeat for each table (action_items, people, teams, projects,
-- document_embeddings, calendar_events, activity_log)
-- Same pattern: FOR <operation> USING (auth.uid() = user_id)
```

**3. Apply migration:**
```bash
supabase db push    # Pushes to remote Supabase project
```

### Pitfalls to Avoid
- **Store only storage paths in `transcript_path`**, never signed URLs. Signed URLs expire; storage paths are permanent.
- **`auth.uid()` returns `NULL` when no JWT is present** — RLS silently returns empty arrays rather than errors. This makes auth bugs look like data bugs.
- **Create separate RLS policies per operation** (SELECT, INSERT, UPDATE, DELETE). PostgreSQL does not support combined operations in a single policy.
- **The HNSW index should be created in the initial migration** even though RAG is Phase 3 — the DDL enforces embedding dimension consistency from day one.
- **Never use the service role key** in FastAPI for user-scoped queries. The service role bypasses RLS entirely.

---

## 5. File Upload + Supabase Storage

### Key Findings

- FastAPI requires `python-multipart` for file uploads (`UploadFile` type).
- Supabase Python client provides `supabase.storage.from_("bucket").upload(path, file_bytes, options)`.
- **Private buckets** are correct for transcripts — access requires signed URLs.
- Signed URLs can be created with configurable expiry via `create_signed_url(path, expires_in)`.
- File size validation should read the file size via `seek(0, 2)` / `tell()` then `seek(0)` — not from Content-Length header (can be spoofed or absent).

### Recommended Approach

**1. Create storage bucket in Supabase dashboard:**
- Bucket name: `transcripts`
- Public: No (private)
- File size limit: 512000 bytes (500KB)
- Allowed MIME types: `text/plain`

**2. FastAPI upload endpoint:**
```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from datetime import datetime

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_client

router = APIRouter()

MAX_FILE_SIZE = 500 * 1024  # 500KB


@router.post("/meetings/upload", status_code=202)
async def upload_transcript(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    # Validate file type
    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(status_code=422, detail="Only .txt files are accepted")

    # Validate file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    await file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="File exceeds 500KB limit")

    # Read file content
    content = await file.read()
    transcript_text = content.decode("utf-8")

    # Generate storage path (never store signed URL)
    now = datetime.utcnow()
    storage_path = (
        f"{user.id}/{now.year}/{now.month:02d}/"
        f"{now.strftime('%Y-%m-%d')}_{file.filename}"
    )

    # Upload to Supabase Storage
    supabase = get_supabase_client()
    supabase.storage.from_("transcripts").upload(
        path=storage_path,
        file=content,
        file_options={"content-type": "text/plain"},
    )

    # Create meeting record in DB (status: pending)
    # ... insert into meetings table with transcript_path = storage_path
    # ... trigger background task for AI processing
    # ... return meeting_id

    return {"meeting_id": meeting_id, "status": "processing"}
```

**3. Signed URL generation (on read):**
```python
def get_transcript_url(storage_path: str, expires_in: int = 900) -> str:
    """Generate a signed URL valid for 15 minutes."""
    supabase = get_supabase_client()
    result = supabase.storage.from_("transcripts").create_signed_url(
        path=storage_path,
        expires_in=expires_in,  # seconds
    )
    return result["signedURL"]
```

### Pitfalls to Avoid
- **Never store signed URLs in the database.** They expire. Store the storage path only.
- **Install `python-multipart`** (`pip install python-multipart`) — FastAPI does not include it by default and file uploads silently fail without it.
- **Validate file size server-side** even if the frontend also validates. The `file.file.seek(0, 2)` pattern is the reliable approach.
- **Use `content.decode("utf-8")` with error handling** for the raw transcript text — some files may have encoding issues.

---

## 6. LLM Provider Protocol Pattern

### Key Findings

- **`instructor` v1.14.5** (latest as of 2026-01-29) is the correct library for enforcing Pydantic schemas on LLM output across providers.
- Instructor's `from_provider()` is the recommended unified interface: `instructor.from_provider("ollama/llama3.1")` and `instructor.from_provider("anthropic/claude-sonnet-4-20250514")`.
- For Ollama, instructor uses **JSON mode** by default. For function-calling-capable models (llama3.1, llama3.2), it can use **TOOLS mode** automatically.
- For Anthropic/Claude, instructor uses the native structured output support.
- The `response_model` parameter enforces a Pydantic model on the output with automatic retries on validation failure.
- `max_retries` controls retry attempts; `timeout` controls total time across all retries (not per-attempt).

### Recommended Approach

**1. Define the Protocol:**
```python
# app/ai/provider.py
from typing import Protocol, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(Protocol):
    async def generate(self, messages: list[dict], model: str | None = None) -> str:
        """Generate raw text completion."""
        ...

    async def generate_structured(
        self,
        messages: list[dict],
        response_model: type[T],
        model: str | None = None,
        max_retries: int = 2,
    ) -> T:
        """Generate structured output validated against a Pydantic model."""
        ...

    async def health_check(self) -> bool:
        """Check if the provider is reachable."""
        ...
```

**2. Ollama implementation:**
```python
# app/ai/providers/ollama_provider.py
import instructor
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import settings


class OllamaProvider:
    def __init__(self):
        self._client = instructor.from_openai(
            AsyncOpenAI(
                base_url=settings.OLLAMA_BASE_URL + "/v1",
                api_key="ollama",  # Required by OpenAI client, unused by Ollama
            ),
            mode=instructor.Mode.JSON,
        )
        self.default_model = "llama3.1:8b-instruct-q4_K_M"

    async def generate_structured(
        self,
        messages: list[dict],
        response_model: type[BaseModel],
        model: str | None = None,
        max_retries: int = 2,
    ) -> BaseModel:
        return await self._client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
            response_model=response_model,
            max_retries=max_retries,
            timeout=120.0,  # 2 min total for Ollama
        )

    async def health_check(self) -> bool:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False
```

**3. Claude/Anthropic implementation:**
```python
# app/ai/providers/claude_provider.py
import instructor
from anthropic import AsyncAnthropic
from pydantic import BaseModel

from app.core.config import settings


class ClaudeProvider:
    def __init__(self):
        self._client = instructor.from_provider(
            "anthropic/claude-sonnet-4-20250514",
            async_client=AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY),
        )
        self.default_model = "claude-sonnet-4-20250514"

    async def generate_structured(
        self,
        messages: list[dict],
        response_model: type[BaseModel],
        model: str | None = None,
        max_retries: int = 2,
    ) -> BaseModel:
        return await self._client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
            response_model=response_model,
            max_retries=max_retries,
            max_tokens=4096,
        )

    async def health_check(self) -> bool:
        try:
            # Simple model list check
            return True  # Anthropic API is generally available
        except Exception:
            return False
```

**4. Factory:**
```python
# app/ai/factory.py
from app.core.config import settings
from app.ai.providers.ollama_provider import OllamaProvider
from app.ai.providers.claude_provider import ClaudeProvider


def create_llm_provider():
    if settings.LLM_PROVIDER == "claude":
        return ClaudeProvider()
    return OllamaProvider()  # Default to Ollama


# FastAPI dependency
async def get_llm_provider():
    return create_llm_provider()
```

**5. Pydantic response models (shared by both providers):**
```python
# app/ai/schemas.py
from pydantic import BaseModel, Field


class MeetingSummary(BaseModel):
    overview: str = Field(description="2-3 sentence overview of the meeting")
    key_topics: list[str] = Field(description="Main topics discussed")
    decisions: list[str] = Field(description="Decisions made during the meeting")
    follow_ups: list[str] = Field(description="Follow-up items mentioned")


class ExtractedActionItem(BaseModel):
    description: str = Field(description="What needs to be done")
    owner_name: str | None = Field(default=None, description="Person responsible")
    due_date: str | None = Field(default=None, description="Due date if mentioned (ISO format)")


class ActionItemsResult(BaseModel):
    action_items: list[ExtractedActionItem]


class MeetingTypeResult(BaseModel):
    meeting_type: str = Field(description="One of: 1on1, team_huddle, project_review, business_partner, other")
    confidence: str = Field(description="One of: high, medium, low")
```

### Pitfalls to Avoid
- **The `instructor` `from_provider()` API may change between versions.** Pin to `instructor>=1.14.0,<2.0`. The older `from_openai()` / `from_anthropic()` methods also work and are more stable.
- **Ollama's JSON mode requires the model to actually support it.** `llama3.1:8b-instruct-q4_K_M` supports JSON mode. Verify with a simple test before building features.
- **Set generous timeouts for Ollama** (120s) but strict timeouts for Claude (30s). The timeout in instructor is total across retries, not per-attempt.
- **Log every raw LLM response during development.** When structured output fails, you need to see what the model actually returned. Add a debug table or log file.
- **Both providers must return the same Pydantic models.** The schema is the contract — provider differences are hidden inside the implementation.

---

## 7. Jinja2 Prompt Templates

### Key Findings

- Jinja2 3.1.x ships as a transitive dependency of FastAPI (via Starlette). No additional install needed.
- Templates should be stored in a dedicated directory: `backend/app/ai/prompts/`.
- Each AI task gets its own template: `summarize_meeting.j2`, `extract_action_items.j2`, `detect_meeting_type.j2`.
- Templates receive variables at render time: `{{ transcript }}`, `{{ meeting_date }}`, etc.
- The system prompt (role instructions) should be separate from the user prompt (task + data).

### Recommended Approach

**1. Directory structure:**
```
backend/app/ai/prompts/
  summarize_meeting.j2
  extract_action_items.j2
  detect_meeting_type.j2
```

**2. Example template (`summarize_meeting.j2`):**
```jinja2
You are an expert meeting analyst. Analyze the following meeting transcript and produce a structured summary.

{% if meeting_date %}Meeting date: {{ meeting_date }}{% endif %}
{% if attendees %}Attendees: {{ attendees | join(', ') }}{% endif %}

TRANSCRIPT:
---
{{ transcript }}
---

Produce a JSON summary with these fields:
- overview: A 2-3 sentence overview of what was discussed
- key_topics: List of main topics discussed
- decisions: List of any decisions made
- follow_ups: List of follow-up items mentioned

Respond ONLY with valid JSON matching the schema. Do not include markdown fences.

Example output:
{
  "overview": "The team discussed Q4 planning and resource allocation.",
  "key_topics": ["Q4 planning", "resource allocation"],
  "decisions": ["Hire two additional engineers"],
  "follow_ups": ["Draft job descriptions by Friday"]
}
```

**3. Template renderer utility:**
```python
# app/ai/prompt_renderer.py
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

PROMPTS_DIR = Path(__file__).parent / "prompts"

_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    autoescape=False,        # No HTML escaping for LLM prompts
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_prompt(template_name: str, **kwargs) -> str:
    template = _env.get_template(template_name)
    return template.render(**kwargs)
```

**4. Usage in AI service:**
```python
from app.ai.prompt_renderer import render_prompt
from app.ai.schemas import MeetingSummary

prompt = render_prompt(
    "summarize_meeting.j2",
    transcript=transcript_text,
    meeting_date="2026-03-04",
    attendees=["Alice", "Bob"],
)

summary = await provider.generate_structured(
    messages=[{"role": "user", "content": prompt}],
    response_model=MeetingSummary,
)
```

### Pitfalls to Avoid
- **Set `autoescape=False`** in the Jinja2 Environment. The default `True` is for HTML and will break prompt content.
- **Include a concrete JSON example in every prompt template.** Models follow examples more reliably than schema descriptions alone.
- **Separate system and user prompts in the messages array.** Pass the role instructions as a system message, the task + transcript as a user message.
- **Consider per-provider template variants** (`summarize_meeting_ollama.j2`, `summarize_meeting_claude.j2`) if quality diverges significantly. Start with a single template and split only if needed.

---

## 8. Background Processing for Long-Running AI Calls

### Key Findings

- **FastAPI `BackgroundTasks`** is sufficient for a single-user app. No Celery/ARQ needed.
- The pattern: endpoint returns `202 Accepted` with a `meeting_id`, background task runs AI processing, frontend polls `GET /meetings/{id}` until `status == "completed"`.
- For multi-step progress (parsing, summarizing, extracting, detecting), store the current step in the meeting record or a separate status field.
- BackgroundTasks run in the same event loop — long-running CPU-bound work should use `asyncio.to_thread()` or `run_in_executor()` to avoid blocking.

### Recommended Approach

**1. Endpoint returns 202 immediately:**
```python
from fastapi import BackgroundTasks

@router.post("/meetings/upload", status_code=202)
async def upload_transcript(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
):
    # ... validate and store file ...
    # ... create meeting record with status="processing" ...

    background_tasks.add_task(
        process_meeting,
        meeting_id=meeting_id,
        transcript_text=transcript_text,
        provider=provider,
        user_id=user.id,
    )

    return {"meeting_id": meeting_id, "status": "processing"}
```

**2. Background processing function with step tracking:**
```python
async def process_meeting(
    meeting_id: str,
    transcript_text: str,
    provider: LLMProvider,
    user_id: str,
):
    try:
        # Step 1: Detect meeting type
        await update_meeting_status(meeting_id, "detecting_type")
        meeting_type = await detect_meeting_type(provider, transcript_text)

        # Step 2: Generate summary
        await update_meeting_status(meeting_id, "summarizing")
        summary = await generate_summary(provider, transcript_text, meeting_type)

        # Step 3: Extract action items
        await update_meeting_status(meeting_id, "extracting_actions")
        action_items = await extract_action_items(provider, transcript_text, summary)

        # Step 4: Save results
        await save_meeting_results(meeting_id, meeting_type, summary, action_items)
        await update_meeting_status(meeting_id, "completed")

    except Exception as e:
        await update_meeting_status(meeting_id, "failed", error_message=str(e))
        # Transcript is already saved — never lost
```

**3. Polling endpoint:**
```python
@router.get("/meetings/{meeting_id}")
async def get_meeting(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    meeting = await fetch_meeting(meeting_id, user.id)
    return meeting  # Includes status, processing_step, summary (if complete)
```

**4. Frontend polling (TanStack Query):**
```typescript
const { data: meeting } = useQuery({
  queryKey: ["meeting", meetingId],
  queryFn: () => api.getMeeting(meetingId),
  refetchInterval: (query) => {
    const status = query.state.data?.status
    if (status === "completed" || status === "failed") return false
    return 2000 // Poll every 2 seconds while processing
  },
})
```

### Pitfalls to Avoid
- **BackgroundTasks share the event loop.** If the LLM provider call is synchronous (blocking), wrap it in `asyncio.to_thread()`. Instructor's async clients should handle this natively.
- **Always save the transcript before starting background processing.** If the background task crashes, the transcript is preserved for retry.
- **Set a processing timeout.** If the background task hangs for >180s (Ollama) or >60s (Claude), mark the meeting as `failed` with a helpful message.
- **The frontend must handle all status transitions gracefully**: `pending` -> `processing` (with step name) -> `completed` or `failed`.

---

## 9. GitHub Actions CI Pipeline

### Key Findings

- Use **path filtering** to run frontend and backend checks independently: `paths: ['backend/**']` and `paths: ['frontend/**']`.
- Python: **Ruff** (v0.4+) for linting+formatting, **mypy** for type checking, **pytest** for tests.
- TypeScript: **ESLint** (v9+) for linting, `tsc --noEmit` for type checking, **Vitest** for tests.
- CI runs on `ubuntu-latest` — no Docker services needed for unit tests.
- Use `uv` for faster Python dependency installation in CI.

### Recommended Approach

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Lint (ruff)
        run: ruff check .

      - name: Format check (ruff)
        run: ruff format --check .

      - name: Type check (mypy)
        run: mypy app/

      - name: Tests (pytest)
        run: pytest tests/ -v
        env:
          SUPABASE_JWT_SECRET: test-secret
          LLM_PROVIDER: ollama
          OLLAMA_BASE_URL: http://localhost:11434

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint (eslint)
        run: npm run lint

      - name: Type check (tsc)
        run: npx tsc --noEmit

      - name: Tests (vitest)
        run: npm run test -- --run

      - name: Build verification
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          NEXT_PUBLIC_API_URL: http://localhost:8000
```

### Pitfalls to Avoid
- **Do NOT run Ollama or Supabase services in CI.** Unit tests should mock LLM providers and database calls.
- **Set dummy environment variables** for the frontend build step — Next.js fails to build without `NEXT_PUBLIC_*` vars even if they are not used at build time.
- **Keep CI fast.** No Docker builds, no integration tests in the main CI pipeline. Target under 3 minutes total.
- **Path filtering** (`paths: ['backend/**']`) can be added later as an optimization but is not critical for a solo-dev project.

---

## 10. Validation Architecture

### Key Findings

- **pytest** (v8+) for Python backend testing. Use `pytest-asyncio` for async test functions.
- **Vitest** (v2+) for Next.js frontend testing. Official Next.js recommendation for App Router projects.
- Async Server Components cannot be unit-tested with Vitest currently — use E2E tests for those.
- Mock LLM providers using the Protocol pattern — swap the real provider with a mock that returns fixture data.
- **httpx** `AsyncClient` for testing FastAPI endpoints without running the server.

### Recommended Approach

**Backend test structure:**
```
backend/tests/
  conftest.py              # Shared fixtures (mock provider, test user, etc.)
  test_auth.py             # JWT validation tests
  test_upload.py           # File upload endpoint tests
  test_ai_pipeline.py     # AI processing pipeline tests (mocked LLM)
  test_schemas.py          # Pydantic model validation tests
  ai/
    test_prompt_renderer.py  # Template rendering tests
    test_ollama_provider.py  # Provider-specific tests
    test_claude_provider.py
```

**Key patterns:**

```python
# conftest.py
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.auth import get_current_user, AuthenticatedUser
from app.ai.factory import get_llm_provider


@pytest.fixture
def mock_user():
    return AuthenticatedUser(id="test-user-id", email="test@example.com", role="authenticated")


@pytest.fixture
def mock_llm_provider():
    """Returns a mock provider that returns fixture data."""
    class MockProvider:
        async def generate_structured(self, messages, response_model, **kwargs):
            # Return valid fixture data for the requested model
            if response_model.__name__ == "MeetingSummary":
                return response_model(
                    overview="Test summary",
                    key_topics=["topic1"],
                    decisions=["decision1"],
                    follow_ups=["followup1"],
                )
            ...

        async def health_check(self):
            return True

    return MockProvider()


@pytest.fixture
def client(mock_user, mock_llm_provider):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm_provider
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")
```

```python
# test_upload.py
import pytest

@pytest.mark.asyncio
async def test_upload_valid_txt(client):
    files = {"file": ("test.txt", b"Speaker 1: Hello\nSpeaker 2: Hi", "text/plain")}
    response = await client.post("/api/v1/meetings/upload", files=files)
    assert response.status_code == 202
    data = response.json()
    assert "meeting_id" in data

@pytest.mark.asyncio
async def test_upload_rejects_non_txt(client):
    files = {"file": ("test.pdf", b"fake content", "application/pdf")}
    response = await client.post("/api/v1/meetings/upload", files=files)
    assert response.status_code == 422
```

**Frontend test structure:**
```
frontend/__tests__/
  lib/
    api.test.ts            # API client tests
  components/
    upload-form.test.tsx   # Component tests
  utils/
    format.test.ts         # Utility function tests
```

**Vitest configuration (`vitest.config.mts`):**
```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./__tests__/setup.ts"],
  },
})
```

**Frontend dependencies:**
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

### Pitfalls to Avoid
- **Mock at the dependency boundary, not deep inside.** FastAPI's `dependency_overrides` is the correct mechanism — swap `get_llm_provider` and `get_current_user`, not individual functions.
- **Async Server Components cannot be tested with Vitest.** Test Client Components and utility functions. Use manual E2E testing for server component flows.
- **Test Pydantic schemas independently.** Validate that edge cases (missing fields, wrong types, empty strings) are handled correctly by the models before testing endpoints.
- **Keep fixture transcripts realistic.** Include real-world patterns: speaker labels, timestamps, partial sentences, multiple topics. Toy inputs do not surface real parsing issues.

---

## Package Inventory

### Python Backend (requirements.txt)

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | `>=0.115.0,<1.0` | Web framework |
| `uvicorn[standard]` | `>=0.30.0` | ASGI server |
| `pydantic` | `>=2.7.0` | Data validation (ships with FastAPI) |
| `pydantic-settings` | `>=2.3.0` | Settings management from env vars |
| `python-multipart` | `>=0.0.9` | File upload support |
| `pyjwt[crypto]` | `>=2.9.0` | JWT decoding for Supabase auth |
| `supabase` | `>=2.6.0` | Supabase Python client (includes storage, auth) |
| `httpx` | `>=0.27.0` | Async HTTP client (for Ollama health checks, etc.) |
| `instructor` | `>=1.14.0,<2.0` | Structured LLM output with Pydantic |
| `openai` | `>=1.40.0` | OpenAI-compatible client (used by instructor for Ollama) |
| `anthropic` | `>=0.40.0` | Anthropic Claude SDK |
| `jinja2` | `>=3.1.0` | Prompt templates (ships with FastAPI/Starlette) |

### Python Backend Dev (requirements-dev.txt)

| Package | Version | Purpose |
|---------|---------|---------|
| `pytest` | `>=8.0.0` | Test framework |
| `pytest-asyncio` | `>=0.23.0` | Async test support |
| `ruff` | `>=0.4.0` | Linter + formatter |
| `mypy` | `>=1.10.0` | Type checking |

### Node.js Frontend (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `15.x` | Framework |
| `react` | `19.x` | UI library (ships with Next.js 15) |
| `react-dom` | `19.x` | DOM rendering |
| `typescript` | `5.x` | Type system |
| `@supabase/supabase-js` | `2.x` | Supabase client |
| `@supabase/ssr` | `0.9.x` | SSR auth utilities |
| `@tanstack/react-query` | `5.x` | Data fetching + caching |
| `tailwindcss` | `3.4.x` | Utility CSS (NOT v4) |
| `postcss` | `8.x` | CSS processing |
| `autoprefixer` | `10.x` | CSS vendor prefixes |

### Node.js Frontend Dev

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | `2.x` | Test framework |
| `@vitejs/plugin-react` | `4.x` | React plugin for Vitest |
| `jsdom` | `24.x` | DOM environment for tests |
| `@testing-library/react` | `16.x` | Component testing |
| `@testing-library/dom` | `10.x` | DOM testing utilities |
| `vite-tsconfig-paths` | `5.x` | Path alias support in tests |
| `eslint` | `9.x` | Linting |
| `eslint-config-next` | `15.x` | Next.js ESLint rules |

### shadcn/ui (installed via CLI, not npm)

```bash
npx shadcn@latest init
npx shadcn@latest add button card input textarea table badge dialog tabs
```

Pulls in as dependencies: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.

### Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 27+ | Containerization |
| Docker Compose | v2 (bundled) | Multi-service orchestration |
| Supabase CLI | 2.x | Database migrations, local dev |
| Ollama | 0.4+ | Local LLM runtime (runs natively, not in Docker) |
| Node.js | 20 LTS | Frontend runtime |
| Python | 3.12.x | Backend runtime |

---

*Research completed: 2026-03-04*
*Phase: 01-foundation-auth-core-ai-pipeline*
