export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  team_id?: string;
  team_name?: string;
  created_at: string;
}

export interface ProjectDetail extends Project {
  meeting_count: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  meetings: Array<{
    id: string;
    title?: string;
    meeting_date?: string;
    status: string;
  }>;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  status?: string;
  team_id?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: string;
  team_id?: string;
}
