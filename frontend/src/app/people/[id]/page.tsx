"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getPerson, getPersonActionItems } from "@/lib/api";
import type { PersonDetail } from "@/types/people";
import type { ActionItem } from "@/types/meeting";
import { PersonDialog } from "../person-dialog";

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

function StatusBadge({ status }: { status: ActionItem["status"] }) {
  const variants: Record<ActionItem["status"], string> = {
    not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    in_progress:
      "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    complete:
      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    cancelled:
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 line-through",
  };

  const labels: Record<ActionItem["status"], string> = {
    not_started: "To Do",
    in_progress: "In Progress",
    complete: "Done",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function isOverdue(item: ActionItem): boolean {
  if (!item.due_date || item.status === "complete" || item.status === "cancelled") {
    return false;
  }
  return new Date(item.due_date) < new Date();
}

export default function PersonProfilePage() {
  const params = useParams();
  const personId = params.id as string;
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const {
    data: person,
    isLoading: personLoading,
    error: personError,
  } = useQuery<PersonDetail>({
    queryKey: ["person", personId],
    queryFn: () => getPerson(personId, token!),
    enabled: !!token && !!personId,
  });

  const { data: actionItems } = useQuery<ActionItem[]>({
    queryKey: ["personActionItems", personId],
    queryFn: () => getPersonActionItems(personId, token!),
    enabled: !!token && !!personId,
  });

  function handlePersonSaved() {
    queryClient.invalidateQueries({ queryKey: ["person", personId] });
    queryClient.invalidateQueries({
      queryKey: ["personActionItems", personId],
    });
  }

  // Group action items by status
  const todoItems = actionItems?.filter((i) => i.status === "not_started") ?? [];
  const inProgressItems =
    actionItems?.filter((i) => i.status === "in_progress") ?? [];
  const doneItems = actionItems?.filter(
    (i) => i.status === "complete" || i.status === "cancelled"
  ) ?? [];

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (personLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (personError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">
          Failed to load person. Please try again.
        </p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Person not found.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/people"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to People
      </Link>

      {/* Person header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{person.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            {person.role_title && (
              <span className="text-muted-foreground">
                {person.role_title}
              </span>
            )}
            {person.team_name && (
              <Badge variant="secondary">{person.team_name}</Badge>
            )}
          </div>
          {person.aliases && (
            <p className="mt-1 text-sm text-muted-foreground">
              Also known as: {person.aliases}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditDialogOpen(true)}
        >
          <Pencil className="mr-1 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{person.total_items}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {person.completed_items}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                person.overdue_items > 0 ? "text-red-600" : ""
              }`}
            >
              {person.overdue_items}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {Math.round(person.completion_rate * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Action Items</h2>

        {!actionItems || actionItems.length === 0 ? (
          <p className="text-muted-foreground">No action items assigned.</p>
        ) : (
          <div className="space-y-6">
            {/* To Do */}
            {todoItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  To Do ({todoItems.length})
                </h3>
                <div className="space-y-2">
                  {todoItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* In Progress */}
            {inProgressItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  In Progress ({inProgressItems.length})
                </h3>
                <div className="space-y-2">
                  {inProgressItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Done */}
            {doneItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Done ({doneItems.length})
                </h3>
                <div className="space-y-2">
                  {doneItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Edit Dialog */}
      <PersonDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        person={person}
        token={token}
        onSaved={handlePersonSaved}
      />
    </main>
  );
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const overdue = isOverdue(item);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex-1">
        <p className="text-sm">{item.description}</p>
        <div className="mt-1 flex items-center gap-2">
          {item.due_date && (
            <span
              className={`text-xs ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}
            >
              Due: {item.due_date}
            </span>
          )}
          {item.meeting_id && (
            <Link
              href={`/meetings/${item.meeting_id}`}
              className="text-xs text-primary hover:underline"
            >
              Source meeting
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {overdue && (
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        )}
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}
