"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { getProjects, archiveProject } from "@/lib/api";
import type { Project } from "@/types/project";
import { ProjectDialog } from "./project-dialog";

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

export default function ProjectsPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(
    undefined
  );

  const {
    data: projects,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects", includeArchived],
    queryFn: () => getProjects(token!, includeArchived),
    enabled: !!token,
  });

  const handleProjectSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  async function handleArchive(project: Project) {
    if (!token) return;
    try {
      await archiveProject(project.id, token);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch {
      // Could add toast notification
    }
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setDialogOpen(true);
  }

  function openAdd() {
    setEditingProject(undefined);
    setDialogOpen(true);
  }

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage projects and their linked meetings and tasks.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Include archived toggle */}
      <div className="mb-4">
        <Button
          variant={includeArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setIncludeArchived(!includeArchived)}
        >
          {includeArchived ? "Hide Archived" : "Include Archived"}
        </Button>
      </div>

      {/* Table */}
      {error ? (
        <p className="text-destructive">Failed to load projects.</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading projects...</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[160px]">Team</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!projects || projects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No projects found. Click &quot;New Project&quot; to create
                    one.
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>{statusBadge(project.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.team_name || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(project)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleArchive(project)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog */}
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editingProject}
        token={token}
        onSaved={handleProjectSaved}
      />
    </main>
  );
}
