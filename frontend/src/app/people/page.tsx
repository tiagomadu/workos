"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  getPeople,
  getTeams,
  deletePerson,
  deleteTeam,
  updatePerson,
} from "@/lib/api";
import type { Person, Team } from "@/types/people";
import { PersonDialog } from "./person-dialog";
import { TeamDialog } from "./team-dialog";

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

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function PeoplePage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Person dialog state
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>(
    undefined
  );

  // Team dialog state
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>(undefined);

  const {
    data: people,
    isLoading: peopleLoading,
    error: peopleError,
  } = useQuery({
    queryKey: ["people", debouncedSearch],
    queryFn: () => getPeople(token!, debouncedSearch || undefined),
    enabled: !!token,
  });

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => getTeams(token!),
    enabled: !!token,
  });

  const handlePersonSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["people"] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
  }, [queryClient]);

  const handleTeamSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
  }, [queryClient]);

  async function handleDeletePerson(person: Person) {
    if (!token) return;
    try {
      await deletePerson(person.id, token);
      queryClient.invalidateQueries({ queryKey: ["people"] });
    } catch {
      // Could add toast notification here
    }
  }

  async function handleDeleteTeam(team: Team) {
    if (!token) return;
    try {
      await deleteTeam(team.id, token);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
    } catch {
      // Could add toast notification here
    }
  }

  async function handleTeamChange(person: Person, newTeamId: string) {
    if (!token) return;
    const teamId = newTeamId === "__none__" ? undefined : newTeamId;
    try {
      await updatePerson(person.id, { team_id: teamId }, token);
      queryClient.invalidateQueries({ queryKey: ["people"] });
    } catch {
      // Could add toast notification here
    }
  }

  function openEditPerson(person: Person) {
    setEditingPerson(person);
    setPersonDialogOpen(true);
  }

  function openAddPerson() {
    setEditingPerson(undefined);
    setPersonDialogOpen(true);
  }

  function openEditTeam(team: Team) {
    setEditingTeam(team);
    setTeamDialogOpen(true);
  }

  function openAddTeam() {
    setEditingTeam(undefined);
    setTeamDialogOpen(true);
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
          <h1 className="text-3xl font-bold">People Directory</h1>
          <p className="mt-1 text-muted-foreground">
            Manage people and teams in your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openAddTeam}>
            <Users className="mr-1 h-4 w-4" />
            Add Team
          </Button>
          <Button size="sm" onClick={openAddPerson}>
            <Plus className="mr-1 h-4 w-4" />
            Add Person
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people by name, role, or alias..."
          className="max-w-md"
        />
      </div>

      {/* People table */}
      {peopleError ? (
        <p className="text-destructive">Failed to load people.</p>
      ) : peopleLoading ? (
        <p className="text-muted-foreground">Loading people...</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[180px]">Role</TableHead>
                <TableHead className="w-[180px]">Team</TableHead>
                <TableHead className="w-[80px]">Items</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!people || people.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No people found.{" "}
                    {search
                      ? "Try a different search."
                      : 'Click "Add Person" to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <Link
                        href={`/people/${person.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {person.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.role_title || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={person.team_id || "__none__"}
                        onValueChange={(val) => handleTeamChange(person, val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No team</SelectItem>
                          {teams?.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {person.action_item_count != null &&
                      person.action_item_count > 0 ? (
                        <Badge variant="secondary">
                          {person.action_item_count}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditPerson(person)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeletePerson(person)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Teams section */}
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Teams</h2>
        {teamsLoading ? (
          <p className="text-muted-foreground">Loading teams...</p>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead className="w-[180px]">Lead</TableHead>
                  <TableHead className="w-[100px]">Members</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!teams || teams.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No teams yet. Click &quot;Add Team&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {team.lead_name || "\u2014"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{team.member_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditTeam(team)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteTeam(team)}
                          >
                            <Trash2 className="h-4 w-4" />
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
      </section>

      {/* Dialogs */}
      <PersonDialog
        open={personDialogOpen}
        onOpenChange={setPersonDialogOpen}
        person={editingPerson}
        token={token}
        onSaved={handlePersonSaved}
      />
      <TeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        team={editingTeam}
        token={token}
        onSaved={handleTeamSaved}
      />
    </main>
  );
}
