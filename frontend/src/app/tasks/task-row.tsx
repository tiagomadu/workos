"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTask, archiveTask } from "@/lib/api";
import type { Task } from "@/types/task";

interface TaskRowProps {
  task: Task;
  token: string;
  onUpdate: () => void;
}

const STATUS_OPTIONS = [
  { value: "not_started", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Done" },
];

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueDateInfo(dateStr?: string): {
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dateStr) return { isOverdue: false, isToday: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const isToday = due.getTime() === today.getTime();
  const isOverdue = due.getTime() < today.getTime();
  return { isOverdue, isToday };
}

export function TaskRow({ task, token, onUpdate }: TaskRowProps) {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description);

  async function handleStatusChange(newStatus: string) {
    try {
      await updateTask(task.id, { status: newStatus }, token);
      onUpdate();
    } catch {
      // Could add toast notification
    }
  }

  async function handleDescSave() {
    if (editDesc.trim() === task.description) {
      setIsEditingDesc(false);
      return;
    }
    try {
      await updateTask(task.id, { description: editDesc.trim() }, token);
      onUpdate();
    } catch {
      // Could add toast notification
    }
    setIsEditingDesc(false);
  }

  async function handleArchive() {
    try {
      await archiveTask(task.id, token);
      onUpdate();
    } catch {
      // Could add toast notification
    }
  }

  const dueDateInfo = getDueDateInfo(task.due_date);
  const isOverdueRow =
    task.is_overdue && task.status !== "complete" && task.status !== "cancelled";

  return (
    <TableRow className={isOverdueRow ? "bg-red-50 dark:bg-red-950/20" : ""}>
      {/* Status */}
      <TableCell>
        <Select value={task.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Description */}
      <TableCell>
        {isEditingDesc ? (
          <Input
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onBlur={handleDescSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDescSave();
              if (e.key === "Escape") {
                setEditDesc(task.description);
                setIsEditingDesc(false);
              }
            }}
            className="h-8 text-sm"
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="cursor-pointer text-left text-sm hover:underline"
            onClick={() => {
              setEditDesc(task.description);
              setIsEditingDesc(true);
            }}
          >
            {task.description}
          </button>
        )}
      </TableCell>

      {/* Owner */}
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

      {/* Due Date */}
      <TableCell className="text-sm">
        <div className="flex items-center gap-1">
          <span>{formatDate(task.due_date)}</span>
          {task.status !== "complete" &&
            task.status !== "cancelled" &&
            dueDateInfo.isOverdue && (
              <Badge variant="destructive" className="text-[10px]">
                Overdue
              </Badge>
            )}
          {task.status !== "complete" &&
            task.status !== "cancelled" &&
            dueDateInfo.isToday && (
              <Badge
                className="border-amber-300 bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              >
                Today
              </Badge>
            )}
        </div>
      </TableCell>

      {/* Project */}
      <TableCell className="text-sm">
        {task.project_id ? (
          <Link
            href={`/projects/${task.project_id}`}
            className="text-primary hover:underline"
          >
            {task.project_name || "Project"}
          </Link>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>

      {/* Source meeting */}
      <TableCell className="text-sm">
        {task.meeting_id ? (
          <Link
            href={`/meetings/${task.meeting_id}`}
            className="text-primary hover:underline"
          >
            {task.meeting_title || "Meeting"}
          </Link>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleArchive}
          title="Archive task"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
