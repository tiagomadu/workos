export interface DashboardData {
  meetings_count_7d: number;
  action_items: {
    overdue: DashboardActionItem[];
    today: DashboardActionItem[];
    this_week: DashboardActionItem[];
    later: DashboardActionItem[];
  };
  action_items_counts: {
    overdue: number;
    today: number;
    this_week: number;
    later: number;
    total: number;
  };
  projects: DashboardProject[];
  upcoming_events: DashboardCalendarEvent[];
}

export interface DashboardActionItem {
  id: string;
  description: string;
  owner_name?: string;
  due_date?: string;
  status: string;
  meeting_id?: string;
  meeting_title?: string;
  is_overdue: boolean;
}

export interface DashboardProject {
  id: string;
  name: string;
  status: string;
  task_count: number;
  overdue_count: number;
}

export interface DashboardCalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  attendees_count: number;
}
