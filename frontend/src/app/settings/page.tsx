"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  getGoogleAuthUrl,
  getGoogleStatus,
  connectGoogle,
  disconnectGoogle,
  syncCalendar,
} from "@/lib/api";

function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  return token;
}

function SettingsContent() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const {
    data: status,
    isLoading: statusLoading,
  } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => getGoogleStatus(token!),
    enabled: !!token,
  });

  // Handle OAuth callback code
  const code = searchParams.get("code");

  const connectMutation = useMutation({
    mutationFn: (oauthCode: string) => connectGoogle(oauthCode, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
      router.replace("/settings");
    },
  });

  useEffect(() => {
    if (code && token && !connectMutation.isPending && !connectMutation.isSuccess) {
      connectMutation.mutate(code);
    }
  }, [code, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncMutation = useMutation({
    mutationFn: () => syncCalendar(token!),
    onSuccess: (data) => {
      setSyncMessage(`Synced ${data.events_synced} events.`);
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: () => {
      setSyncMessage("Sync failed. Please try again.");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGoogle(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
    },
  });

  const handleConnect = useCallback(async () => {
    if (!token) return;
    try {
      const { url } = await getGoogleAuthUrl(token);
      window.location.href = url;
    } catch {
      // Could add toast notification
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Google Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Google Integration</CardTitle>
          <CardDescription>
            Connect your Google account to sync calendar events and browse
            Gmail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading || connectMutation.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {connectMutation.isPending
                  ? "Connecting Google account..."
                  : "Loading..."}
              </span>
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="border-green-300 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Connected
                </Badge>
                {status.email && (
                  <span className="text-sm text-muted-foreground">
                    {status.email}
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Last synced:{" "}
                {status.last_synced
                  ? new Date(status.last_synced).toLocaleString()
                  : "Never"}
              </p>

              {status.scopes && (
                <p className="text-xs text-muted-foreground">
                  Scopes: {status.scopes}
                </p>
              )}

              {syncMessage && (
                <p className="text-sm text-green-700 dark:text-green-400">
                  {syncMessage}
                </p>
              )}

              {connectMutation.isError && (
                <p className="text-sm text-destructive">
                  Failed to connect Google account. Please try again.
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnectMutation.isPending && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {connectMutation.isError && (
                <p className="text-sm text-destructive">
                  Failed to connect Google account. Please try again.
                </p>
              )}
              <Button size="sm" onClick={handleConnect}>
                Connect Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
