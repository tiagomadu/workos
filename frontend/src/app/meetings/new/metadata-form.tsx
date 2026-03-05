"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjects } from "@/lib/api";

export interface MeetingMetadata {
  title: string;
  meeting_date: string;
  project_id: string;
}

interface MetadataFormProps {
  metadata: MeetingMetadata;
  onChange: (metadata: MeetingMetadata) => void;
  token?: string | null;
}

export function MetadataForm({ metadata, onChange, token }: MetadataFormProps) {
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(token!),
    enabled: !!token,
  });

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
        <Select
          value={metadata.project_id || "__none__"}
          onValueChange={(val) =>
            update("project_id", val === "__none__" ? "" : val)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No project</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
