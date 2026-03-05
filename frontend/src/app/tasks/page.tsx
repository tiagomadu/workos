"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { getTasks } from "@/lib/api";
import type { TaskFilters as TaskFiltersType } from "@/types/task";
import { TaskFilters } from "./task-filters";
import { TaskRow } from "./task-row";
import { CreateTaskDialog } from "./create-task-dialog";

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

export default function TasksPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<TaskFiltersType>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: tasks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => getTasks(token!, filters),
    enabled: !!token,
  });

  const handleTaskUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [queryClient]);

  const handleTaskCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [queryClient]);

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Tracker</h1>
          <p className="mt-1 text-muted-foreground">
            View and manage all action items across meetings and projects.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          token={token}
        />
      </div>

      {/* Table */}
      {error ? (
        <p className="text-destructive">Failed to load tasks.</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading tasks...</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px]">Owner</TableHead>
                <TableHead className="w-[160px]">Due Date</TableHead>
                <TableHead className="w-[140px]">Project</TableHead>
                <TableHead className="w-[140px]">Source</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!tasks || tasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No tasks found.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    token={token}
                    onUpdate={handleTaskUpdate}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        onSaved={handleTaskCreated}
      />
    </main>
  );
}
