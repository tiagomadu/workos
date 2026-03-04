"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
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
import type { ActionItem } from "@/types/meeting";

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

export function ActionItemsTable({
  initialItems,
  onSave,
}: ActionItemsTableProps) {
  const [items, setItems] = useState<ActionItem[]>(initialItems);

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
              <TableHead className="w-[140px]">Owner</TableHead>
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
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={item.owner_name ?? ""}
                        onChange={(e) =>
                          updateItem(index, {
                            owner_name: e.target.value || null,
                          })
                        }
                        placeholder="Owner"
                        className="h-8 text-xs"
                      />
                      {item.owner_name && item.owner_name.trim() !== "" && (
                        <span title="No match found in people directory">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        </span>
                      )}
                    </div>
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
