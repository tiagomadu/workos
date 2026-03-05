"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Archive, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  getProject,
  getTasks,
  archiveProject,
  updateTask,
  archiveTask,
} from "@/lib/api";
import type { ProjectDetail } from "@/types/project";
import type { Task } from "@/types/task";
import { ProjectDialog } from "../project-dialog";

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
    case "archived":
      return <Badge variant="secondary">Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function meetingStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="border-green-300 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Completed
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TASK_STATUS_OPTIONS = [
  { value: "not_started", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Done" },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId, token!),
    enabled: !!token && !!projectId,
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["tasks", { project_id: projectId }],
    queryFn: () => getTasks(token!, { project_id: projectId }),
    enabled: !!token && !!projectId,
  });

  const handleProjectSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient, projectId]);

  async function handleArchiveProject() {
    if (!token || !project) return;
    try {
      await archiveProject(project.id, token);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch {
      // Could add toast
    }
  }

  async function handleTaskStatusChange(taskId: string, newStatus: string) {
    if (!token) return;
    try {
      await updateTask(taskId, { status: newStatus }, token);
      queryClient.invalidateQueries({
        queryKey: ["tasks", { project_id: projectId }],
      });
    } catch {
      // Could add toast
    }
  }

  async function handleArchiveTask(taskId: string) {
    if (!token) return;
    try {
      await archiveTask(taskId, token);
      queryClient.invalidateQueries({
        queryKey: ["tasks", { project_id: projectId }],
      });
    } catch {
      // Could add toast
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">
          Failed to load project. Please try again.
        </p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const openTasks = project.total_tasks - project.completed_tasks;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Top section */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {statusBadge(project.status)}
          </div>
          {project.team_name && (
            <p className="mt-1 text-sm text-muted-foreground">
              Team: {project.team_name}
            </p>
          )}
          {project.description && (
            <p className="mt-2 text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleArchiveProject}
          >
            <Archive className="mr-1 h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{project.meeting_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                project.overdue_tasks > 0 ? "text-destructive" : ""
              }`}
            >
              {project.overdue_tasks}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linked Meetings */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Linked Meetings</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting</TableHead>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!project.meetings || project.meetings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No meetings linked to this project yet.
                  </TableCell>
                </TableRow>
              ) : (
                project.meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell>
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {meeting.title || "Meeting"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(meeting.meeting_date)}
                    </TableCell>
                    <TableCell>
                      {meetingStatusBadge(meeting.status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Action Items */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Action Items</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px]">Owner</TableHead>
                <TableHead className="w-[140px]">Due Date</TableHead>
                <TableHead className="w-[140px]">Source</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!tasks || tasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No action items for this project yet.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className={
                      task.is_overdue &&
                      task.status !== "complete" &&
                      task.status !== "cancelled"
                        ? "bg-red-50 dark:bg-red-950/20"
                        : ""
                    }
                  >
                    <TableCell>
                      <Select
                        value={task.status}
                        onValueChange={(val) =>
                          handleTaskStatusChange(task.id, val)
                        }
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">
                      {task.description}
                    </TableCell>
                    <TableCell className="text-sm">
                      {task.owner_id ? (
                        <Link
                          href={`/people/${task.owner_id}`}
                          className="text-primary hover:underline"
                        >
                          {task.owner_name || "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {task.owner_name || "\u2014"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <span>{formatDate(task.due_date)}</span>
                        {task.is_overdue &&
                          task.status !== "complete" &&
                          task.status !== "cancelled" && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Overdue
                            </Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {task.meeting_id ? (
                        <Link
                          href={`/meetings/${task.meeting_id}`}
                          className="text-primary hover:underline"
                        >
                          {task.meeting_title || "Meeting"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {"\u2014"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleArchiveTask(task.id)}
                        title="Archive task"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Edit dialog */}
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={project}
        token={token}
        onSaved={handleProjectSaved}
      />
    </main>
  );
}
