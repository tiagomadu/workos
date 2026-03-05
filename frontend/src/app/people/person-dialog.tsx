"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPerson, updatePerson, getTeams } from "@/lib/api";
import type { Person, PersonCreate, PersonUpdate } from "@/types/people";

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
  token: string;
  onSaved: () => void;
}

export function PersonDialog({
  open,
  onOpenChange,
  person,
  token,
  onSaved,
}: PersonDialogProps) {
  const isEdit = !!person;

  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [aliases, setAliases] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: () => getTeams(token),
    enabled: open && !!token,
  });

  useEffect(() => {
    if (open) {
      setName(person?.name ?? "");
      setRoleTitle(person?.role_title ?? "");
      setTeamId(person?.team_id ?? "");
      setAliases(person?.aliases ?? "");
      setError(null);
    }
  }, [open, person]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        const data: PersonUpdate = {
          name: name.trim(),
          role_title: roleTitle.trim() || undefined,
          team_id: teamId || undefined,
          aliases: aliases.trim() || undefined,
        };
        await updatePerson(person.id, data, token);
      } else {
        const data: PersonCreate = {
          name: name.trim(),
          role_title: roleTitle.trim() || undefined,
          team_id: teamId || undefined,
          aliases: aliases.trim() || undefined,
        };
        await createPerson(data, token);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Person" : "Add Person"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this person's information."
              : "Add a new person to the directory."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role / Title</label>
            <Input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g., Engineering Manager"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Aliases</label>
            <Input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g., Mike, Michael"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
