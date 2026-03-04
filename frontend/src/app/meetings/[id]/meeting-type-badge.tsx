"use client";

import { Badge } from "@/components/ui/badge";

interface MeetingTypeBadgeProps {
  meetingType: string;
  confidence: string;
}

const TYPE_LABELS: Record<string, string> = {
  "1on1": "1:1",
  team_huddle: "Team Huddle",
  project_review: "Project Review",
  business_partner: "Business Partner",
  other: "Other",
};

function formatMeetingType(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  // Fallback: replace underscores with spaces and title case
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getVariant(
  confidence: string
): "default" | "secondary" | "outline" {
  switch (confidence) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "secondary";
  }
}

export function MeetingTypeBadge({
  meetingType,
  confidence,
}: MeetingTypeBadgeProps) {
  return (
    <Badge variant={getVariant(confidence)}>
      {formatMeetingType(meetingType)}
      <span className="ml-1 font-normal opacity-60">{confidence}</span>
    </Badge>
  );
}
