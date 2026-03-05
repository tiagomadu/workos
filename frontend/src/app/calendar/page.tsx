"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getCalendarEvents, getGoogleStatus } from "@/lib/api";
import type { CalendarEvent } from "@/types/calendar";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatAttendees(
  attendees: CalendarEvent["attendees"]
): string {
  if (!attendees || attendees.length === 0) return "\u2014";

  const names = attendees.map((a) => {
    if (typeof a === "string") return a;
    return a.displayName || a.email || "Unknown";
  });

  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

export default function CalendarPage() {
  const token = useAuthToken();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => getGoogleStatus(token!),
    enabled: !!token,
  });

  const {
    data: events,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => getCalendarEvents(token!),
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
          <h1 className="text-3xl font-bold">Calendar Events</h1>
          <p className="mt-1 text-muted-foreground">
            View and manage synced Google Calendar events.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Google Calendar Not Connected</CardTitle>
            <CardDescription>
              Connect your Google account in Settings to sync calendar events.
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
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Calendar Events</h1>
        <p className="mt-1 text-muted-foreground">
          View and manage synced Google Calendar events.
        </p>
      </div>

      {/* Table */}
      {eventsError ? (
        <p className="text-destructive">Failed to load calendar events.</p>
      ) : eventsLoading ? (
        <p className="text-muted-foreground">Loading calendar events...</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead className="w-[100px]">Duration</TableHead>
                <TableHead className="w-[200px]">Attendees</TableHead>
                <TableHead className="w-[140px]">Linked Meeting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!events || events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No calendar events synced yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {event.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(event.start_time).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(event.start_time)} &ndash;{" "}
                      {formatTime(event.end_time)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(event.start_time, event.end_time)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAttendees(event.attendees)}
                    </TableCell>
                    <TableCell>
                      {event.meeting_id ? (
                        <Link
                          href={`/meetings/${event.meeting_id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View Meeting
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          &mdash;
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
