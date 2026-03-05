"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getCalendarMatches,
  getCalendarEvents,
  linkCalendarEvent,
  unlinkCalendarEvent,
} from "@/lib/api";
import type { CalendarEvent } from "@/types/calendar";

interface CalendarMatchBannerProps {
  meetingId: string;
  token: string;
  calendarEventId?: string | null;
  onLinked?: () => void;
}

export function CalendarMatchBanner({
  meetingId,
  token,
  calendarEventId,
  onLinked,
}: CalendarMatchBannerProps) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [chooseDialogOpen, setChooseDialogOpen] = useState(false);

  // Fetch match suggestions when no calendar event is linked
  const { data: matches } = useQuery({
    queryKey: ["calendar-matches", meetingId],
    queryFn: () => getCalendarMatches(meetingId, token),
    enabled: !calendarEventId && !dismissed,
  });

  // Fetch all calendar events for the "Choose Other" dialog
  const { data: allEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => getCalendarEvents(token),
    enabled: chooseDialogOpen,
  });

  const linkMutation = useMutation({
    mutationFn: (eventId: string) =>
      linkCalendarEvent(meetingId, eventId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      queryClient.invalidateQueries({
        queryKey: ["calendar-matches", meetingId],
      });
      setChooseDialogOpen(false);
      onLinked?.();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkCalendarEvent(meetingId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      onLinked?.();
    },
  });

  // Show linked state
  if (calendarEventId) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
        <span className="text-sm text-blue-800 dark:text-blue-300">
          Linked to a calendar event
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => unlinkMutation.mutate()}
          disabled={unlinkMutation.isPending}
        >
          {unlinkMutation.isPending && (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          )}
          Unlink
        </Button>
      </div>
    );
  }

  // No matches or dismissed
  const topMatch = matches && matches.length > 0 ? matches[0] : null;
  if (!topMatch || dismissed) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
        <span className="text-sm text-amber-800 dark:text-amber-300">
          This may match &ldquo;{topMatch.event_title}&rdquo; on{" "}
          {topMatch.event_date}. Link?
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => linkMutation.mutate(topMatch.calendar_event_id)}
            disabled={linkMutation.isPending}
          >
            {linkMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChooseDialogOpen(true)}
          >
            Choose Other
          </Button>
        </div>
      </div>

      {/* Choose Other Dialog */}
      <Dialog open={chooseDialogOpen} onOpenChange={setChooseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Calendar Event</DialogTitle>
            <DialogDescription>
              Choose a calendar event to link to this meeting.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {eventsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !allEvents || allEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No calendar events available.
              </p>
            ) : (
              <div className="space-y-2">
                {allEvents.map((event: CalendarEvent) => (
                  <button
                    key={event.id}
                    className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                    onClick={() => linkMutation.mutate(event.id)}
                    disabled={linkMutation.isPending}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.start_time).toLocaleDateString()} &middot;{" "}
                      {new Date(event.start_time).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
