"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ActionItem } from "@/types/meeting";
import { getPeople, resolvePerson } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface ActionItemsTableProps {
  initialItems: ActionItem[];
  onSave: (items: ActionItem[]) => void;
}

const STATUS_OPTIONS: { value: ActionItem["status"]; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

function newEmptyItem(): ActionItem {
  return {
    description: "",
    owner_name: null,
    due_date: null,
    status: "not_started",
  };
}

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

function OwnerCell({
  item,
  token,
  onUpdate,
}: {
  item: ActionItem;
  token: string | null;
  onUpdate: (updates: Partial<ActionItem>) => void;
}) {
  const queryClient = useQueryClient();
  const [assignMode, setAssignMode] = useState(false);

  const { data: allPeople } = useQuery({
    queryKey: ["people"],
    queryFn: () => getPeople(token!),
    enabled: !!token && (assignMode || item.owner_status === "unresolved"),
    staleTime: 30000,
  });

  async function handleResolve(personId: string, actionItemId: string) {
    if (!token || !actionItemId) return;
    try {
      await resolvePerson(personId, actionItemId, token);
      queryClient.invalidateQueries({ queryKey: ["actionItems"] });
    } catch {
      // Could add toast notification here
    }
  }

  // Resolved owner -- show green checkmark and link
  if (item.owner_status === "resolved" && item.owner_id) {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
        <Link
          href={`/people/${item.owner_id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          {item.owner_name}
        </Link>
      </div>
    );
  }

  // Ambiguous owner -- show amber name with candidate dropdown
  if (item.owner_status === "ambiguous" && item.owner_candidates && item.id) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-xs font-medium text-amber-600">
            {item.owner_name}
          </span>
        </div>
        <Select
          onValueChange={(personId) => handleResolve(personId, item.id!)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Pick match..." />
          </SelectTrigger>
          <SelectContent>
            {item.owner_candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({Math.round(c.score * 100)}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Unresolved owner -- show orange name with assign button/dropdown
  if (item.owner_status === "unresolved" && item.owner_name) {
    if (assignMode) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            <span className="text-xs font-medium text-orange-600">
              {item.owner_name}
            </span>
          </div>
          <Select
            onValueChange={(personId) => {
              if (item.id) handleResolve(personId, item.id);
              setAssignMode(false);
            }}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select person..." />
            </SelectTrigger>
            <SelectContent>
              {allPeople?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        <span className="text-xs font-medium text-orange-600">
          {item.owner_name}
        </span>
        {item.id && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Assign to a person"
            onClick={() => setAssignMode(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  // No owner or no owner_status (new row or null owner) -- editable input
  if (!item.owner_name || !item.owner_status) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          value={item.owner_name ?? ""}
          onChange={(e) =>
            onUpdate({ owner_name: e.target.value || null })
          }
          placeholder={item.owner_name === null ? "Unassigned" : "Owner"}
          className="h-8 text-xs"
        />
        {item.owner_name && item.owner_name.trim() !== "" && !item.owner_status && (
          <span title="No match found in people directory">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          </span>
        )}
      </div>
    );
  }

  // Fallback -- unassigned
  return <span className="text-xs text-muted-foreground">Unassigned</span>;
}

export function ActionItemsTable({
  initialItems,
  onSave,
}: ActionItemsTableProps) {
  const [items, setItems] = useState<ActionItem[]>(initialItems);
  const token = useAuthToken();

  // Sync with prop changes (e.g., after owner resolution refetch)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function updateItem(index: number, updates: Partial<ActionItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((prev) => [...prev, newEmptyItem()]);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Owner</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[140px]">Due Date</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No action items yet. Click &quot;Add Item&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={item.id ?? index}>
                  <TableCell>
                    <OwnerCell
                      item={item}
                      token={token}
                      onUpdate={(updates) => updateItem(index, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                      placeholder="Describe the action item..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={item.due_date ?? ""}
                      onChange={(e) =>
                        updateItem(index, {
                          due_date: e.target.value || null,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateItem(index, {
                          status: e.target.value as ActionItem["status"],
                        })
                      }
                      className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" />
            Add Item
          </Button>
          <span className="text-xs text-muted-foreground">
            {items.length} action item{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button size="sm" onClick={() => onSave(items)}>
          Save All
        </Button>
      </div>
    </div>
  );
}
