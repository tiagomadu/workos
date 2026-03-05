"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadTranscript, pasteTranscript, getMeeting } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UploadTab } from "./upload-tab";
import { PasteTab } from "./paste-tab";
import { PreviewPanel } from "./preview-panel";
import { MetadataForm, type MeetingMetadata } from "./metadata-form";
import { ProcessingIndicator } from "./processing-indicator";

type Phase = "idle" | "preview" | "processing";

function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewMeetingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<MeetingMetadata>({
    title: "",
    meeting_date: todayString(),
    project_id: "",
  });

  // Synchronous token for child components that need it for React Query
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, [supabase]);

  // --- Helpers ---

  const getToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }
    return session.access_token;
  }, [supabase]);

  // --- File selected handler ---

  const handleFileSelected = useCallback(
    (selectedFile: File, fileText: string) => {
      setFile(selectedFile);
      setText(fileText);
      setMetadata((prev) => ({
        ...prev,
        title: selectedFile.name.replace(/\.txt$/i, ""),
      }));
      setPhase("preview");
    },
    []
  );

  // --- Text submitted handler ---

  const handleTextSubmitted = useCallback((submittedText: string) => {
    setFile(null);
    setText(submittedText);
    setPhase("preview");
  }, []);

  // --- Cancel preview ---

  const handleCancel = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setText("");
    setUploadError(null);
    setMetadata({ title: "", meeting_date: todayString(), project_id: "" });
  }, []);

  // --- Upload / paste mutation ---

  const processMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const meta = {
        title: metadata.title || undefined,
        meeting_date: metadata.meeting_date || undefined,
        project_id: metadata.project_id || undefined,
      };

      if (file) {
        return uploadTranscript(file, token, meta);
      }
      return pasteTranscript(text, token, meta);
    },
    onSuccess: (data) => {
      setMeetingId(data.meeting_id);
      setPhase("processing");
      setUploadError(null);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  // --- Polling query for processing status ---

  const meetingQuery = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const token = await getToken();
      return getMeeting(meetingId!, token);
    },
    enabled: phase === "processing" && !!meetingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") {
        return false;
      }
      return 2000;
    },
  });

  // Redirect to meeting detail on completion
  const meetingStatus = meetingQuery.data?.status;
  if (meetingStatus === "completed" && meetingId) {
    router.push(`/meetings/${meetingId}`);
  }

  // --- Retry handler ---

  const handleRetry = useCallback(() => {
    setMeetingId(null);
    setPhase("preview");
  }, []);

  // --- Render ---

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">New Meeting</h1>
        <p className="mt-1 text-muted-foreground">
          Upload or paste a meeting transcript to generate an AI summary.
        </p>
      </div>

      {/* IDLE PHASE */}
      {phase === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>Add Transcript</CardTitle>
            <CardDescription>
              Upload a .txt file or paste your transcript text directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload">
              <TabsList className="mb-4">
                <TabsTrigger value="upload">Upload File</TabsTrigger>
                <TabsTrigger value="paste">Paste Text</TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                <UploadTab onFileSelected={handleFileSelected} />
              </TabsContent>
              <TabsContent value="paste">
                <PasteTab onTextSubmitted={handleTextSubmitted} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* PREVIEW PHASE */}
      {phase === "preview" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <PreviewPanel
                  filename={file?.name}
                  text={text}
                  fileSize={file?.size ?? new Blob([text]).size}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
                <CardDescription>Optional metadata</CardDescription>
              </CardHeader>
              <CardContent>
                <MetadataForm metadata={metadata} onChange={setMetadata} token={token} />
              </CardContent>
            </Card>
          </div>

          {uploadError && (
            <p className="text-sm text-red-500">{uploadError}</p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
            >
              {processMutation.isPending ? "Uploading..." : "Process"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={processMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* PROCESSING PHASE */}
      {phase === "processing" && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Transcript</CardTitle>
            <CardDescription>
              {metadata.title || "Your transcript"} is being analyzed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProcessingIndicator
              status={meetingQuery.data?.status ?? "pending"}
              processingStep={meetingQuery.data?.processing_step}
              errorMessage={meetingQuery.data?.error_message}
              llmProvider={meetingQuery.data?.llm_provider}
              onRetry={handleRetry}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
