"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingSummary } from "@/types/meeting";

interface SummaryEditorProps {
  summary: MeetingSummary;
  onSave: (summary: MeetingSummary) => void;
  onCancel: () => void;
}

export function SummaryEditor({
  summary,
  onSave,
  onCancel,
}: SummaryEditorProps) {
  const [overview, setOverview] = useState(summary.overview);
  const [keyTopics, setKeyTopics] = useState(
    summary.key_topics.join("\n")
  );
  const [decisions, setDecisions] = useState(
    summary.decisions.join("\n")
  );
  const [followUps, setFollowUps] = useState(
    summary.follow_ups.join("\n")
  );

  function handleSave() {
    const updated: MeetingSummary = {
      overview: overview.trim(),
      key_topics: keyTopics
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      decisions: decisions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      follow_ups: followUps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onSave(updated);
  }

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          Overview
        </label>
        <Textarea
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          rows={4}
          placeholder="Meeting overview..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          Key Topics
        </label>
        <p className="text-xs text-muted-foreground">
          One topic per line
        </p>
        <Textarea
          value={keyTopics}
          onChange={(e) => setKeyTopics(e.target.value)}
          rows={4}
          placeholder="Enter key topics, one per line..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          Decisions
        </label>
        <p className="text-xs text-muted-foreground">
          One decision per line
        </p>
        <Textarea
          value={decisions}
          onChange={(e) => setDecisions(e.target.value)}
          rows={4}
          placeholder="Enter decisions, one per line..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          Follow-ups
        </label>
        <p className="text-xs text-muted-foreground">
          One follow-up per line
        </p>
        <Textarea
          value={followUps}
          onChange={(e) => setFollowUps(e.target.value)}
          rows={4}
          placeholder="Enter follow-ups, one per line..."
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
