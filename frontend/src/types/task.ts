export interface Task {
  id: string;
  description: string;
  owner_name?: string;
  owner_id?: string;
  owner_status?: "resolved" | "ambiguous" | "unresolved";
  due_date?: string;
  status: "not_started" | "in_progress" | "complete" | "cancelled";
  project_id?: string;
  project_name?: string;
  meeting_id?: string;
  meeting_title?: string;
  is_archived: boolean;
  is_overdue: boolean;
  created_at: string;
}

export interface TaskCreate {
  description: string;
  owner_name?: string;
  owner_id?: string;
  due_date?: string;
  status?: string;
  project_id?: string;
}

export interface TaskUpdate {
  description?: string;
  owner_name?: string;
  owner_id?: string;
  due_date?: string;
  status?: string;
  project_id?: string;
}

export interface TaskFilters {
  status?: string;
  owner_id?: string;
  project_id?: string;
  sort_by?: string;
  include_archived?: boolean;
}
