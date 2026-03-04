export interface MeetingUploadResponse {
  meeting_id: string;
  status: string;
}

export interface Meeting {
  id: string;
  status:
    | "pending"
    | "processing"
    | "detecting_type"
    | "summarizing"
    | "extracting_actions"
    | "completed"
    | "failed";
  title?: string;
  meeting_type?: string;
  meeting_type_confidence?: string;
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
  due_date: string | null; // YYYY-MM-DD
  status: "not_started" | "in_progress" | "complete" | "cancelled";
}

export type ProcessingStep =
  | "detecting_type"
  | "summarizing"
  | "extracting_actions"
  | "completed"
  | "failed";
