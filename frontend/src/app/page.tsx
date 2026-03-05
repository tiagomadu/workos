"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ClipboardList,
  FolderOpen,
  Upload,
  Search,
  Users,
  UsersRound,
  Mail,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/client";
import { getDashboard } from "@/lib/api";
import type { DashboardActionItem, DashboardProject } from "@/types/dashboard";

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

function statusBadge(status: string) {
  switch (status) {
    case "on_track":
      return (
        <Badge className="border-green-300 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          On Track
        </Badge>
      );
    case "at_risk":
      return (
        <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          At Risk
        </Badge>
      );
    case "blocked":
      return <Badge variant="destructive">Blocked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatEventTime(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startStr = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endStr = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${startStr} – ${endStr}`;
}

export default function DashboardPage() {
  const token = useAuthToken();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(token!),
    enabled: !!token,
    refetchInterval: 60_000, // refresh every minute
  });

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">Failed to load dashboard.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const { action_items, action_items_counts, projects, upcoming_events } = data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your week at a glance</p>
        </div>
        <SignOutButton />
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Left: Meetings Metric */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Meetings This Week
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{data.meetings_count_7d}</div>
            <p className="text-xs text-muted-foreground mt-1">
              processed in the last 7 days
            </p>
            <Link href="/meetings/new">
              <Button variant="outline" size="sm" className="mt-4">
                <Upload className="mr-1 h-4 w-4" />
                New Meeting
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Top Right: Upcoming Calendar Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Events
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcoming_events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No upcoming events this week.
              </p>
            ) : (
              <div className="space-y-3">
                {upcoming_events.slice(0, 5).map((evt) => (
                  <div key={evt.id} className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {evt.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventTime(evt.start_time, evt.end_time)}
                      </p>
                    </div>
                    {evt.attendees_count > 0 && (
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {evt.attendees_count}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Link href="/calendar">
              <Button variant="outline" size="sm" className="mt-4">
                View Calendar
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Bottom Left: Action Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Action Items</CardTitle>
            <Badge variant="secondary">{action_items_counts.total}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overdue */}
            {action_items_counts.overdue > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium text-red-600 dark:text-red-400">
                    Overdue
                  </h3>
                  <Badge variant="destructive" className="text-xs">
                    {action_items_counts.overdue}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {action_items.overdue.map((item: DashboardActionItem) => (
                    <button
                      key={item.id}
                      onClick={() => router.push("/tasks")}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="line-clamp-1">{item.description}</span>
                      {item.owner_name && (
                        <span className="text-xs text-muted-foreground ml-1">
                          — {item.owner_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Today */}
            {action_items_counts.today > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Due Today
                  </h3>
                  <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                    {action_items_counts.today}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {action_items.today.map((item: DashboardActionItem) => (
                    <button
                      key={item.id}
                      onClick={() => router.push("/tasks")}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="line-clamp-1">{item.description}</span>
                      {item.owner_name && (
                        <span className="text-xs text-muted-foreground ml-1">
                          — {item.owner_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* This Week */}
            {action_items_counts.this_week > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium">This Week</h3>
                  <Badge variant="secondary" className="text-xs">
                    {action_items_counts.this_week}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {action_items.this_week.map((item: DashboardActionItem) => (
                    <button
                      key={item.id}
                      onClick={() => router.push("/tasks")}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="line-clamp-1">{item.description}</span>
                      {item.owner_name && (
                        <span className="text-xs text-muted-foreground ml-1">
                          — {item.owner_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Later (collapsed) */}
            {action_items_counts.later > 0 && (
              <details>
                <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Later
                  <Badge variant="secondary" className="text-xs">
                    {action_items_counts.later}
                  </Badge>
                </summary>
                <div className="space-y-1 mt-2">
                  {action_items.later.map((item: DashboardActionItem) => (
                    <button
                      key={item.id}
                      onClick={() => router.push("/tasks")}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="line-clamp-1">{item.description}</span>
                      {item.owner_name && (
                        <span className="text-xs text-muted-foreground ml-1">
                          — {item.owner_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </details>
            )}

            {action_items_counts.total === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No open action items.
              </p>
            )}

            <Link href="/tasks">
              <Button variant="outline" size="sm" className="mt-2">
                View All Tasks
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Bottom Right: Active Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Projects
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No active projects.
              </p>
            ) : (
              <div className="space-y-3">
                {projects.map((proj: DashboardProject) => (
                  <Link
                    key={proj.id}
                    href={`/projects/${proj.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{proj.name}</span>
                      {statusBadge(proj.status)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {proj.task_count} task{proj.task_count !== 1 ? "s" : ""}
                      {proj.overdue_count > 0 && (
                        <span className="text-red-600 dark:text-red-400 ml-1">
                          ({proj.overdue_count} overdue)
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/projects">
              <Button variant="outline" size="sm" className="mt-4">
                View All Projects
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick navigation links */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
        <Link
          href="/meetings/new"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Meeting
        </Link>
        <Link
          href="/search"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </Link>
        <Link
          href="/people"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          People
        </Link>
        <Link
          href="/teams"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <UsersRound className="h-3.5 w-3.5" />
          Teams
        </Link>
        <Link
          href="/calendar"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Calendar className="h-3.5 w-3.5" />
          Calendar
        </Link>
        <Link
          href="/emails"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Mail className="h-3.5 w-3.5" />
          Emails
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>
    </main>
  );
}
