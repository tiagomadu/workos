"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { getGmailThread, importEmailThread } from "@/lib/api";

interface EmailThreadPreviewProps {
  threadId: string;
  token: string;
  onImported?: (meetingId: string) => void;
}

export function EmailThreadPreview({
  threadId,
  token,
  onImported,
}: EmailThreadPreviewProps) {
  const router = useRouter();

  const {
    data: thread,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["gmail-thread", threadId],
    queryFn: () => getGmailThread(threadId, token),
    enabled: !!threadId && !!token,
  });

  const importMutation = useMutation({
    mutationFn: () => importEmailThread(threadId, token),
    onSuccess: (data) => {
      onImported?.(data.meeting_id);
      router.push(`/meetings/${data.meeting_id}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading thread...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !thread) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-destructive">Failed to load email thread.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="text-lg">{thread.subject}</CardTitle>
        <Button
          size="sm"
          onClick={() => importMutation.mutate()}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          )}
          Import as Meeting
        </Button>
      </CardHeader>
      <CardContent>
        {importMutation.isError && (
          <p className="mb-4 text-sm text-destructive">
            Failed to import thread. Please try again.
          </p>
        )}

        <div className="space-y-4">
          {thread.messages.map((message, index) => (
            <div key={message.message_id}>
              {index > 0 && <div className="mb-4 border-t" />}
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{message.from_address}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(message.date).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm">
                {message.body}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
