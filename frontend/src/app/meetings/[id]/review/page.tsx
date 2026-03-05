"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus, FileText, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import {
  getMeetingReviewData,
  confirmReview,
  skipReview,
  suggestDocuments,
} from "@/lib/api";
import type {
  MeetingReviewData,
  MeetingSummary,
  ReviewActionItem,
  DocumentSuggestion,
} from "@/types/meeting";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEETING_TYPES = [
  { value: "1on1", label: "1:1" },
  { value: "team_huddle", label: "Team Huddle" },
  { value: "project_review", label: "Project Review" },
  { value: "business_partner", label: "Business Partner" },
  { value: "other", label: "Other" },
] as const;

// ---------------------------------------------------------------------------
// Auth hook (same pattern as other pages)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MeetingReviewPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;
  const token = useAuthToken();

  // ---- Remote data ----
  const {
    data,
    isLoading,
    error,
  } = useQuery<MeetingReviewData>({
    queryKey: ["meetingReview", meetingId],
    queryFn: () => getMeetingReviewData(meetingId, token!),
    enabled: !!token && !!meetingId,
  });

  // ---- Local editable state ----
  const [meetingType, setMeetingType] = useState<string>("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [summary, setSummary] = useState<MeetingSummary>({
    overview: "",
    key_topics: [],
    decisions: [],
    follow_ups: [],
  });
  const [actionItems, setActionItems] = useState<ReviewActionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---- Document suggestions state ----
  const [docSuggestions, setDocSuggestions] = useState<DocumentSuggestion[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docChecked, setDocChecked] = useState<Record<number, boolean>>({});
  const [docRequested, setDocRequested] = useState(false);

  // ---- Seed local state from fetched data ----
  useEffect(() => {
    if (!data) return;
    setMeetingType(data.meeting_type ?? "other");
    setProjectId(data.suggested_project_id ?? null);
    setSummary(
      data.summary ?? {
        overview: "",
        key_topics: [],
        decisions: [],
        follow_ups: [],
      }
    );
    setActionItems(data.action_items ?? []);
  }, [data]);

  // ---- Handlers ----

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await confirmReview(
        meetingId,
        {
          meeting_type: meetingType,
          project_id: projectId,
          summary,
          action_items: actionItems.filter((ai) => !ai.deleted),
        },
        token
      );
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save review"
      );
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (!token) return;
    try {
      await skipReview(meetingId, token);
      router.push(`/meetings/${meetingId}`);
    } catch {
      // Silently fail — user can navigate manually
    }
  }

  async function handleSuggestDocuments() {
    if (!token) return;
    setDocLoading(true);
    try {
      const suggestions = await suggestDocuments(
        meetingId,
        {
          meeting_type: meetingType,
          summary_overview: summary.overview,
          key_topics: summary.key_topics,
          decisions: summary.decisions,
        },
        token
      );
      setDocSuggestions(suggestions);
      setDocRequested(true);
    } catch {
      // Could add error display here
    } finally {
      setDocLoading(false);
    }
  }

  // ---- Summary helpers ----

  function updateSummaryList(
    field: "key_topics" | "decisions" | "follow_ups",
    index: number,
    value: string
  ) {
    setSummary((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  }

  function removeSummaryItem(
    field: "key_topics" | "decisions" | "follow_ups",
    index: number
  ) {
    setSummary((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  }

  function addSummaryItem(
    field: "key_topics" | "decisions" | "follow_ups"
  ) {
    setSummary((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  }

  // ---- Action item helpers ----

  function updateActionItem(
    index: number,
    updates: Partial<ReviewActionItem>
  ) {
    setActionItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  function removeActionItem(index: number) {
    setActionItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, deleted: true } : item
      )
    );
  }

  function addActionItem() {
    setActionItems((prev) => [
      ...prev,
      {
        description: "",
        owner_name: null,
        owner_id: null,
        due_date: null,
        status: "not_started",
      },
    ]);
  }

  // ---- Render guards ----

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading review data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">
          Failed to load review data. Please try again.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">No review data found.</p>
      </div>
    );
  }

  // ---- Derived values ----

  const visibleActionItems = actionItems.filter((ai) => !ai.deleted);

  // ---- Render ----

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Review Meeting</h1>
          <p className="text-muted-foreground">
            {data.title || "Untitled"} — Review AI results before saving
          </p>
        </div>
        <Button variant="ghost" onClick={handleSkip}>
          Skip Review
        </Button>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Section 1: Meeting Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MEETING_TYPES.map((mt) => (
              <Badge
                key={mt.value}
                variant={meetingType === mt.value ? "default" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-sm"
                onClick={() => setMeetingType(mt.value)}
              >
                {meetingType === mt.value && (
                  <Check className="mr-1 h-3 w-3" />
                )}
                {mt.label}
              </Badge>
            ))}
          </div>
          {data.meeting_type_confidence != null && (
            <p className="mt-3 text-xs text-muted-foreground">
              AI confidence: {Math.round(data.meeting_type_confidence * 100)}%
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Project Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.suggested_project_id && data.suggested_project_name && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm">
                AI suggests:{" "}
                <span className="font-medium">
                  {data.suggested_project_name}
                </span>
              </span>
              {projectId !== data.suggested_project_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProjectId(data.suggested_project_id!)}
                >
                  Accept
                </Button>
              )}
              {projectId === data.suggested_project_id && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="mr-1 h-3 w-3" />
                  Accepted
                </Badge>
              )}
            </div>
          )}

          <Select
            value={projectId ?? "__none__"}
            onValueChange={(val) =>
              setProjectId(val === "__none__" ? null : val)
            }
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {data.available_projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Section 3: Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Overview
            </label>
            <Textarea
              value={summary.overview}
              onChange={(e) =>
                setSummary((prev) => ({ ...prev, overview: e.target.value }))
              }
              rows={4}
              placeholder="Meeting overview..."
            />
          </div>

          {/* Key Topics */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Key Topics
            </label>
            <div className="space-y-2">
              {summary.key_topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={topic}
                    onChange={(e) =>
                      updateSummaryList("key_topics", i, e.target.value)
                    }
                    placeholder="Topic..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSummaryItem("key_topics", i)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addSummaryItem("key_topics")}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Topic
              </Button>
            </div>
          </div>

          {/* Decisions */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Decisions
            </label>
            <div className="space-y-2">
              {summary.decisions.map((decision, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={decision}
                    onChange={(e) =>
                      updateSummaryList("decisions", i, e.target.value)
                    }
                    placeholder="Decision..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSummaryItem("decisions", i)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addSummaryItem("decisions")}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Decision
              </Button>
            </div>
          </div>

          {/* Follow-ups */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Follow-ups
            </label>
            <div className="space-y-2">
              {summary.follow_ups.map((followUp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={followUp}
                    onChange={(e) =>
                      updateSummaryList("follow_ups", i, e.target.value)
                    }
                    placeholder="Follow-up..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSummaryItem("follow_ups", i)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addSummaryItem("follow_ups")}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Follow-up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Action Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleActionItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Description</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionItems.map((item, index) => {
                  if (item.deleted) return null;
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateActionItem(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Action item description..."
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.owner_id ?? "__none__"}
                          onValueChange={(val) =>
                            updateActionItem(index, {
                              owner_id: val === "__none__" ? null : val,
                              owner_name:
                                val === "__none__"
                                  ? null
                                  : data.available_people?.find(
                                      (p) => p.id === val
                                    )?.name ?? null,
                            })
                          }
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Select owner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {data.available_people?.map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.due_date ?? ""}
                          onChange={(e) =>
                            updateActionItem(index, {
                              due_date: e.target.value || null,
                            })
                          }
                          className="w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeActionItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No action items extracted. Add one below if needed.
            </p>
          )}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={addActionItem}>
              <Plus className="mr-1 h-4 w-4" />
              Add Action Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!docRequested ? (
            <Button
              variant="outline"
              onClick={handleSuggestDocuments}
              disabled={docLoading}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {docLoading ? "Analyzing..." : "Suggest Documents"}
            </Button>
          ) : docSuggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No document suggestions for this meeting.
            </p>
          ) : (
            <div className="space-y-3">
              {docSuggestions.map((suggestion, i) => (
                <label
                  key={i}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={docChecked[i] ?? false}
                    onChange={(e) =>
                      setDocChecked((prev) => ({
                        ...prev,
                        [i]: e.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.doc_type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {suggestion.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t py-4 z-50">
        <div className="mx-auto max-w-4xl flex justify-between items-center px-4">
          <Button variant="outline" onClick={handleSkip}>
            Skip Review
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save & Finish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
