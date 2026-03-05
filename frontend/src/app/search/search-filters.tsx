"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchFilters as SearchFiltersType } from "@/types/search";

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onFiltersChange: (filters: SearchFiltersType) => void;
}

const MEETING_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "1on1", label: "1:1" },
  { value: "team_huddle", label: "Team Huddle" },
  { value: "project_review", label: "Project Review" },
  { value: "business_partner", label: "Business Partner" },
  { value: "other", label: "Other" },
];

export function SearchFilters({
  filters,
  onFiltersChange,
}: SearchFiltersProps) {
  function handleDateFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFiltersChange({
      ...filters,
      date_from: e.target.value || undefined,
    });
  }

  function handleDateToChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFiltersChange({
      ...filters,
      date_to: e.target.value || undefined,
    });
  }

  function handleMeetingTypeChange(type: string) {
    onFiltersChange({
      ...filters,
      meeting_type: type === "all" ? undefined : type,
    });
  }

  const activeType = filters.meeting_type || "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">From</label>
        <Input
          type="date"
          value={filters.date_from || ""}
          onChange={handleDateFromChange}
          className="h-8 w-[150px] text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">To</label>
        <Input
          type="date"
          value={filters.date_to || ""}
          onChange={handleDateToChange}
          className="h-8 w-[150px] text-xs"
        />
      </div>

      {/* Meeting type chips */}
      <div className="flex items-center gap-1">
        {MEETING_TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={activeType === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleMeetingTypeChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
