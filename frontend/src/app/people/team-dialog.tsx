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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTeam, updateTeam, getPeople } from "@/lib/api";
import type { Team, TeamCreate, TeamUpdate } from "@/types/people";

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  token: string;
  onSaved: () => void;
}

export function TeamDialog({
  open,
  onOpenChange,
  team,
  token,
  onSaved,
}: TeamDialogProps) {
  const isEdit = !!team;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: people } = useQuery({
    queryKey: ["people"],
    queryFn: () => getPeople(token),
    enabled: open && !!token,
  });

  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setDescription(team?.description ?? "");
      setLeadId(team?.lead_id ?? "");
      setError(null);
    }
  }, [open, team]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        const data: TeamUpdate = {
          name: name.trim(),
          description: description.trim() || undefined,
          lead_id: leadId || undefined,
        };
        await updateTeam(team.id, data, token);
      } else {
        const data: TeamCreate = {
          name: name.trim(),
          description: description.trim() || undefined,
          lead_id: leadId || undefined,
        };
        await createTeam(data, token);
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
          <DialogTitle>{isEdit ? "Edit Team" : "Add Team"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this team's information."
              : "Create a new team."}
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
              placeholder="Team name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the team"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Lead</label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No lead</SelectItem>
                {people?.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
