"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getGmailThreads, getGoogleStatus } from "@/lib/api";
import { EmailThreadPreview } from "./email-thread-preview";

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

export default function EmailsPage() {
  const token = useAuthToken();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => getGoogleStatus(token!),
    enabled: !!token,
  });

  const {
    data: threads,
    isLoading: threadsLoading,
    error: threadsError,
  } = useQuery({
    queryKey: ["gmail-threads"],
    queryFn: () => getGmailThreads(token!),
    enabled: !!token && status?.connected === true,
  });

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Email Threads</h1>
          <p className="mt-1 text-muted-foreground">
            Browse and import Gmail conversations.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Gmail Not Connected</CardTitle>
            <CardDescription>
              Connect your Google account in Settings to browse email threads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings">
              <Button size="sm">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Email Threads</h1>
        <p className="mt-1 text-muted-foreground">
          Browse and import Gmail conversations.
        </p>
      </div>

      {/* Thread list */}
      {threadsError ? (
        <p className="text-destructive">Failed to load email threads.</p>
      ) : threadsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading email threads...</span>
        </div>
      ) : !threads || threads.length === 0 ? (
        <p className="text-muted-foreground">No email threads found.</p>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Card
              key={thread.thread_id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedThreadId === thread.thread_id
                  ? "border-primary"
                  : ""
              }`}
              onClick={() => setSelectedThreadId(thread.thread_id)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{thread.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {thread.sender}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {thread.snippet}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-sm text-muted-foreground">
                      {new Date(thread.date).toLocaleDateString()}
                    </span>
                    <Badge variant="secondary">
                      {thread.message_count}{" "}
                      {thread.message_count === 1 ? "message" : "messages"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Thread preview */}
      {selectedThreadId && token && (
        <div className="mt-6">
          <EmailThreadPreview
            threadId={selectedThreadId}
            token={token}
          />
        </div>
      )}
    </main>
  );
}
