export interface Person {
  id: string;
  name: string;
  role_title?: string;
  team_id?: string;
  team_name?: string;
  aliases?: string;
  created_at: string;
  action_item_count?: number;
}

export interface PersonDetail extends Person {
  total_items: number;
  completed_items: number;
  overdue_items: number;
  completion_rate: number;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  lead_id?: string;
  lead_name?: string;
  member_count: number;
  created_at: string;
}

export interface PersonCreate {
  name: string;
  role_title?: string;
  team_id?: string;
  aliases?: string;
}

export interface PersonUpdate {
  name?: string;
  role_title?: string;
  team_id?: string;
  aliases?: string;
}

export interface TeamCreate {
  name: string;
  description?: string;
  lead_id?: string;
}

export interface TeamUpdate {
  name?: string;
  description?: string;
  lead_id?: string;
}

export interface OwnerCandidate {
  id: string;
  name: string;
  score: number;
}
