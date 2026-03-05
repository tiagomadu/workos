"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPeople, getProjects } from "@/lib/api";
import type { TaskFilters as TaskFiltersType } from "@/types/task";

interface TaskFiltersProps {
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
  token: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "not_started", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Done" },
];

export function TaskFilters({
  filters,
  onFiltersChange,
  token,
}: TaskFiltersProps) {
  const { data: people } = useQuery({
    queryKey: ["people"],
    queryFn: () => getPeople(token),
    enabled: !!token,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(token),
    enabled: !!token,
  });

  function handleStatusChange(status: string) {
    onFiltersChange({
      ...filters,
      status: status === "all" ? undefined : status,
    });
  }

  function handleOwnerChange(ownerId: string) {
    onFiltersChange({
      ...filters,
      owner_id: ownerId === "__all__" ? undefined : ownerId,
    });
  }

  function handleProjectChange(projectId: string) {
    onFiltersChange({
      ...filters,
      project_id: projectId === "__all__" ? undefined : projectId,
    });
  }

  function toggleArchived() {
    onFiltersChange({
      ...filters,
      include_archived: !filters.include_archived,
    });
  }

  const activeStatus = filters.status || "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status chips */}
      <div className="flex items-center gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={activeStatus === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Owner filter */}
      <Select
        value={filters.owner_id || "__all__"}
        onValueChange={handleOwnerChange}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="All owners" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All owners</SelectItem>
          {people?.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Project filter */}
      <Select
        value={filters.project_id || "__all__"}
        onValueChange={handleProjectChange}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All projects</SelectItem>
          {projects?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Show archived toggle */}
      <Button
        variant={filters.include_archived ? "default" : "outline"}
        size="sm"
        onClick={toggleArchived}
      >
        {filters.include_archived ? "Hide Archived" : "Show Archived"}
      </Button>
    </div>
  );
}
