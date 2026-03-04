"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  getMeeting,
  getActionItems,
  saveActionItems,
  updateSummary,
  reprocessMeeting,
} from "@/lib/api";
import type { ActionItem, Meeting, MeetingSummary } from "@/types/meeting";
import { ProcessingIndicator } from "@/app/meetings/new/processing-indicator";
import { MeetingTypeBadge } from "./meeting-type-badge";
import { SummaryView } from "./summary-view";
import { SummaryEditor } from "./summary-editor";
import { ActionItemsTable } from "./action-items-table";

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

export default function MeetingDetailPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  const {
    data: meeting,
    isLoading: meetingLoading,
    error: meetingError,
  } = useQuery<Meeting>({
    queryKey: ["meeting", meetingId],
    queryFn: () => getMeeting(meetingId, token!),
    enabled: !!token && !!meetingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        status &&
        status !== "completed" &&
        status !== "failed"
      ) {
        return 2000;
      }
      return false;
    },
  });

  const { data: actionItems } = useQuery<ActionItem[]>({
    queryKey: ["actionItems", meetingId],
    queryFn: () => getActionItems(meetingId, token!),
    enabled: !!token && !!meetingId && meeting?.status === "completed",
  });

  const isProcessing =
    meeting?.status !== "completed" && meeting?.status !== "failed";

  async function handleReprocess() {
    if (!token) return;
    setIsReprocessing(true);
    try {
      await reprocessMeeting(meetingId, token);
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      queryClient.invalidateQueries({
        queryKey: ["actionItems", meetingId],
      });
    } catch {
      // Error handling could be improved with toast notifications
      setIsReprocessing(false);
    }
  }

  async function handleSaveSummary(summary: MeetingSummary) {
    if (!token) return;
    try {
      await updateSummary(meetingId, summary, token);
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      setIsEditing(false);
    } catch {
      // Error handling could be improved with toast notifications
    }
  }

  async function handleSaveActionItems(items: ActionItem[]) {
    if (!token) return;
    try {
      await saveActionItems(meetingId, items, token);
      queryClient.invalidateQueries({
        queryKey: ["actionItems", meetingId],
      });
    } catch {
      // Error handling could be improved with toast notifications
    }
  }

  // Reset reprocessing flag when meeting goes back to processing
  useEffect(() => {
    if (meeting && isProcessing) {
      // Meeting is being processed, keep indicator up
    }
    if (meeting?.status === "completed" || meeting?.status === "failed") {
      setIsReprocessing(false);
    }
  }, [meeting, isProcessing]);

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (meetingLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading meeting...</p>
      </div>
    );
  }

  if (meetingError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">
          Failed to load meeting. Please try again.
        </p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Meeting not found.</p>
      </div>
    );
  }

  // Show processing indicator if meeting is still being processed or reprocessing
  if (isProcessing || isReprocessing) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card className="p-8">
          <h1 className="mb-6 text-lg font-semibold">
            {meeting.title || "Processing Meeting"}
          </h1>
          <ProcessingIndicator
            status={meeting.status}
            errorMessage={meeting.error_message}
            llmProvider={meeting.llm_provider}
            onRetry={handleReprocess}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {meeting.title || "Meeting"}
          </h1>
          {meeting.meeting_type && meeting.meeting_type_confidence && (
            <MeetingTypeBadge
              meetingType={meeting.meeting_type}
              confidence={meeting.meeting_type_confidence}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Pencil className="mr-1 h-4 w-4" />
            {isEditing ? "Cancel Edit" : "Edit"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReprocess}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Re-run
          </Button>
        </div>
      </div>

      {/* Summary section */}
      {meeting.summary && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Summary</h2>
          {isEditing ? (
            <SummaryEditor
              summary={meeting.summary}
              onSave={handleSaveSummary}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <SummaryView summary={meeting.summary} />
          )}
        </section>
      )}

      {/* Action items section */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Action Items</h2>
        <ActionItemsTable
          initialItems={actionItems ?? []}
          onSave={handleSaveActionItems}
        />
      </section>
    </div>
  );
}
