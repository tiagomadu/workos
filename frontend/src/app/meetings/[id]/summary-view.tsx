"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MeetingSummary } from "@/types/meeting";

interface SummaryViewProps {
  summary: MeetingSummary;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </div>
  );
}

export function SummaryView({ summary }: SummaryViewProps) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card p-4">
      <CollapsibleSection title="Overview">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {summary.overview}
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Key Topics">
        {summary.key_topics.length > 0 ? (
          <ul className="space-y-1.5">
            {summary.key_topics.map((topic, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                {topic}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            No key topics identified.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Decisions">
        {summary.decisions.length > 0 ? (
          <ul className="space-y-1.5">
            {summary.decisions.map((decision, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                {decision}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            No decisions recorded.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Follow-ups">
        {summary.follow_ups.length > 0 ? (
          <ul className="space-y-1.5">
            {summary.follow_ups.map((followUp, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                {followUp}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            No follow-ups identified.
          </p>
        )}
      </CollapsibleSection>
    </div>
  );
}
