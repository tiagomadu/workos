import type { OwnerCandidate } from "./people";

export interface MeetingUploadResponse {
  meeting_id: string;
  status: string;
}

export interface Meeting {
  id: string;
  status:
    | "pending"
    | "uploaded"
    | "processing"
    | "completed"
    | "failed";
  processing_step?:
    | "detecting_type"
    | "suggesting_project"
    | "summarizing"
    | "extracting_actions"
    | "resolving_owners"
    | "generating_embeddings"
    | null;
  review_status?: "pending_review" | "reviewed" | null;
  suggested_project_id?: string | null;
  title?: string;
  meeting_date?: string;
  meeting_type?: string;
  meeting_type_confidence?: string;
  project_id?: string;
  project_name?: string;
  calendar_event_id?: string | null;
  summary?: MeetingSummary;
  error_message?: string;
  created_at: string;
  llm_provider?: string;
}

export interface MeetingSummary {
  overview: string;
  key_topics: string[];
  decisions: string[];
  follow_ups: string[];
}

export interface ActionItem {
  id?: string;
  description: string;
  owner_name: string | null;
  owner_id?: string | null;
  owner_status?: "resolved" | "ambiguous" | "unresolved" | null;
  owner_candidates?: OwnerCandidate[];
  due_date: string | null; // YYYY-MM-DD
  status: "not_started" | "in_progress" | "complete" | "cancelled";
  project_id?: string | null;
  meeting_id?: string;
}

export type ProcessingStep =
  | "detecting_type"
  | "suggesting_project"
  | "summarizing"
  | "extracting_actions"
  | "resolving_owners"
  | "generating_embeddings"
  | "completed"
  | "failed";

// --- Review page types ---

export interface MeetingReviewData {
  id: string;
  title?: string;
  meeting_date?: string;
  status: string;
  review_status?: string;
  meeting_type?: string;
  meeting_type_confidence?: number;
  suggested_project_id?: string;
  suggested_project_name?: string;
  summary?: MeetingSummary;
  action_items: ReviewActionItem[];
  available_projects: Array<{ id: string; name: string }>;
  available_people: Array<{ id: string; name: string }>;
}

export interface ReviewActionItem {
  id?: string;
  description: string;
  owner_name?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  status: string;
  deleted?: boolean;
}

export interface DocumentSuggestion {
  doc_type: string;
  title: string;
  description: string;
  relevance_score: number;
}
