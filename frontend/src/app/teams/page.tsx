"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getTeams } from "@/lib/api";
import type { Team } from "@/types/people";
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

export default function TeamsPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>(undefined);

  const {
    data: teams,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teams"],
    queryFn: () => getTeams(token!),
    enabled: !!token,
  });

  const handleTeamSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["teams"] });
  }, [queryClient]);

  function openCreate() {
    setEditingTeam(undefined);
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
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="mt-1 text-muted-foreground">
            Browse and manage teams in your organization.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Create Team
        </Button>
      </div>

      {/* Content */}
      {error ? (
        <p className="text-destructive">Failed to load teams.</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading teams...</p>
      ) : !teams || teams.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="mb-1 text-lg font-semibold">No teams yet</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first team to start organizing people.
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Create Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="group block"
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      <Users className="mr-1 h-3 w-3" />
                      {team.member_count}
                    </Badge>
                  </div>
                  {team.description && (
                    <CardDescription className="line-clamp-2">
                      {team.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <UserCircle className="mr-1.5 h-4 w-4" />
                    <span>{team.lead_name || "No lead assigned"}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Dialog */}
      <TeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        team={editingTeam}
        token={token}
        onSaved={handleTeamSaved}
      />
    </main>
  );
}
