export interface CalendarEvent {
  id: string;
  google_event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  attendees: Array<{ email?: string; displayName?: string } | string>;
  description?: string;
  meeting_id?: string | null;
  synced_at: string;
}

export interface CalendarSyncResponse {
  events_synced: number;
  last_synced: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
  last_synced?: string;
  scopes?: string;
}

export interface CalendarMatchSuggestion {
  calendar_event_id: string;
  event_title: string;
  event_date: string;
  score: number;
  match_reasons: string[];
}
