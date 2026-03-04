"use client";

import { Input } from "@/components/ui/input";

export interface MeetingMetadata {
  title: string;
  meeting_date: string;
  project_id: string;
}

interface MetadataFormProps {
  metadata: MeetingMetadata;
  onChange: (metadata: MeetingMetadata) => void;
}

export function MetadataForm({ metadata, onChange }: MetadataFormProps) {
  const update = (field: keyof MeetingMetadata, value: string) => {
    onChange({ ...metadata, ...{ [field]: value } });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="title"
          value={metadata.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Meeting title"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="meeting-date" className="text-sm font-medium">
          Date
        </label>
        <Input
          id="meeting-date"
          type="date"
          value={metadata.meeting_date}
          onChange={(e) => update("meeting_date", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="project" className="text-sm font-medium">
          Project
        </label>
        <Input
          id="project"
          value={metadata.project_id}
          onChange={(e) => update("project_id", e.target.value)}
          placeholder="Project name or ID"
        />
      </div>
    </div>
  );
}
