"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SearchSource } from "@/types/search";

interface SearchResultCardProps {
  source: SearchSource;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetingType(type?: string): string {
  if (!type) return "";
  const map: Record<string, string> = {
    "1on1": "1:1",
    team_huddle: "Team Huddle",
    project_review: "Project Review",
    business_partner: "Business Partner",
    other: "Other",
  };
  return map[type] || type;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

export function SearchResultCard({ source }: SearchResultCardProps) {
  const relevance = Math.round(source.similarity * 100);

  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            <Link
              href={`/meetings/${source.meeting_id}`}
              className="text-primary hover:underline"
            >
              {source.meeting_title || "Untitled Meeting"}
            </Link>
          </CardTitle>
          {source.meeting_type && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {formatMeetingType(source.meeting_type)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {source.meeting_date && (
          <p className="text-xs text-muted-foreground">
            {formatDate(source.meeting_date)}
          </p>
        )}
        <p className="text-sm leading-relaxed">
          {truncateText(source.chunk_text, 200)}
        </p>
        <p className="text-xs text-muted-foreground">{relevance}% relevant</p>
      </CardContent>
    </Card>
  );
}
