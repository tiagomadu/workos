"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, Users, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { getTeamDetail, deleteTeam } from "@/lib/api";
import { TeamDialog } from "@/app/people/team-dialog";

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

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => getTeamDetail(teamId, token!),
    enabled: !!token && !!teamId,
  });

  const handleTeamSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
  }, [queryClient, teamId]);

  async function handleDelete() {
    if (!token || !team) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${team.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteTeam(team.id, token);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      router.push("/teams");
    } catch {
      // Could add toast
    }
  }

  // Build a Team-shaped object for the dialog (it expects the Team type)
  const teamForDialog = team
    ? {
        id: team.id,
        name: team.name,
        description: team.description ?? "",
        lead_id: team.lead_id ?? "",
        lead_name: team.lead_name ?? "",
        member_count: team.member_count,
      }
    : undefined;

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">
          Failed to load team. Please try again.
        </p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Team not found.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Back link */}
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Teams
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          {team.description && (
            <p className="mt-2 text-muted-foreground">{team.description}</p>
          )}
          {team.lead_name && (
            <p className="mt-1 text-sm text-muted-foreground">
              Lead: {team.lead_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-1.5 h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderOpen className="mr-1.5 h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Members tab */}
        <TabsContent value="members">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!team.members || team.members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      No members in this team yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  team.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Link
                          href={`/people/${member.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {member.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.role_title || "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.email || "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Projects tab */}
        <TabsContent value="projects">
          {!team.projects || team.projects.length === 0 ? (
            <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No projects assigned to this team yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {team.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group block"
                >
                  <Card className="h-full transition-shadow group-hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">
                          {project.name}
                        </CardTitle>
                        {statusBadge(project.status)}
                      </div>
                    </CardHeader>
                    {project.description && (
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {project.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity tab */}
        <TabsContent value="activity">
          <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              Coming soon
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Team activity feed will be available in a future update.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <TeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        team={teamForDialog}
        token={token}
        onSaved={handleTeamSaved}
      />
    </main>
  );
}
