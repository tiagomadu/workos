import { createBrowserClient } from "@supabase/ssr"

// Placeholder values allow the build to succeed without env vars.
// At runtime, real values are injected via NEXT_PUBLIC_* env vars.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
