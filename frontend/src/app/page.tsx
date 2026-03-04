import { createClient } from "@/lib/supabase/server"
import { SignOutButton } from "@/components/auth/sign-out-button"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">WorkOS</h1>
        <p className="text-muted-foreground">
          Welcome, {user?.email ?? "User"}
        </p>
        <SignOutButton />
      </div>
    </main>
  )
}
