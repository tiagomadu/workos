import type {
  ActionItem,
  Meeting,
  MeetingSummary,
  MeetingUploadResponse,
} from "@/types/meeting";
import type {
  Person,
  PersonDetail,
  PersonCreate,
  PersonUpdate,
  Team,
  TeamCreate,
  TeamUpdate,
} from "@/types/people";
import type { Task, TaskCreate, TaskUpdate, TaskFilters } from "@/types/task";
import type {
  Project,
  ProjectDetail,
  ProjectCreate,
  ProjectUpdate,
} from "@/types/project";
import type { SearchResult, SearchFilters } from "@/types/search";
import type {
  CalendarEvent,
  CalendarSyncResponse,
  GoogleConnectionStatus,
  CalendarMatchSuggestion,
} from "@/types/calendar";
import type { GmailThread, GmailThreadDetail } from "@/types/email";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadTranscript(
  file: File,
  token: string,
  metadata?: { title?: string; meeting_date?: string; project_id?: string }
): Promise<MeetingUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (metadata?.title) formData.append("title", metadata.title);
  if (metadata?.meeting_date)
    formData.append("meeting_date", metadata.meeting_date);
  if (metadata?.project_id)
    formData.append("project_id", metadata.project_id);

  const res = await fetch(`${API_URL}/api/v1/meetings/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }
  return res.json();
}

export async function pasteTranscript(
  text: string,
  token: string,
  metadata?: { title?: string; meeting_date?: string; project_id?: string }
): Promise<MeetingUploadResponse> {
  const res = await fetch(`${API_URL}/api/v1/meetings/paste`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, ...metadata }),
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Paste failed" }));
    throw new Error(error.detail || "Paste failed");
  }
  return res.json();
}

export async function getMeeting(
  meetingId: string,
  token: string
): Promise<Meeting> {
  const res = await fetch(`${API_URL}/api/v1/meetings/${meetingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to fetch meeting" }));
    throw new Error(error.detail || "Failed to fetch meeting");
  }
  return res.json();
}

export async function getActionItems(
  meetingId: string,
  token: string
): Promise<ActionItem[]> {
  const res = await fetch(
    `${API_URL}/api/v1/meetings/${meetingId}/action-items`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to fetch action items" }));
    throw new Error(error.detail || "Failed to fetch action items");
  }
  return res.json();
}

export async function saveActionItems(
  meetingId: string,
  items: ActionItem[],
  token: string
): Promise<ActionItem[]> {
  const res = await fetch(
    `${API_URL}/api/v1/meetings/${meetingId}/action-items`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(items),
    }
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to save action items" }));
    throw new Error(error.detail || "Failed to save action items");
  }
  return res.json();
}

export async function updateSummary(
  meetingId: string,
  summary: MeetingSummary,
  token: string
): Promise<Meeting> {
  const res = await fetch(
    `${API_URL}/api/v1/meetings/${meetingId}/summary`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(summary),
    }
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to update summary" }));
    throw new Error(error.detail || "Failed to update summary");
  }
  return res.json();
}

export async function reprocessMeeting(
  meetingId: string,
  token: string
): Promise<MeetingUploadResponse> {
  const res = await fetch(
    `${API_URL}/api/v1/meetings/${meetingId}/reprocess`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to reprocess" }));
    throw new Error(error.detail || "Failed to reprocess");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export async function getPeople(
  token: string,
  search?: string
): Promise<Person[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${API_URL}/api/v1/people${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch people");
  }
  return res.json();
}

export async function getPerson(
  personId: string,
  token: string
): Promise<PersonDetail> {
  const res = await fetch(`${API_URL}/api/v1/people/${personId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch person");
  }
  return res.json();
}

export async function createPerson(
  data: PersonCreate,
  token: string
): Promise<Person> {
  const res = await fetch(`${API_URL}/api/v1/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create person");
  }
  return res.json();
}

export async function updatePerson(
  personId: string,
  data: PersonUpdate,
  token: string
): Promise<Person> {
  const res = await fetch(`${API_URL}/api/v1/people/${personId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update person");
  }
  return res.json();
}

export async function deletePerson(
  personId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/people/${personId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete person");
  }
}

export async function resolvePerson(
  personId: string,
  actionItemId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/action-items/${actionItemId}/resolve-owner`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ person_id: personId }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to resolve owner");
  }
}

export async function getPersonActionItems(
  personId: string,
  token: string
): Promise<ActionItem[]> {
  const res = await fetch(`${API_URL}/api/v1/people/${personId}/action-items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch person action items");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function getTeams(token: string): Promise<Team[]> {
  const res = await fetch(`${API_URL}/api/v1/teams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch teams");
  }
  return res.json();
}

export async function createTeam(
  data: TeamCreate,
  token: string
): Promise<Team> {
  const res = await fetch(`${API_URL}/api/v1/teams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create team");
  }
  return res.json();
}

export async function updateTeam(
  teamId: string,
  data: TeamUpdate,
  token: string
): Promise<Team> {
  const res = await fetch(`${API_URL}/api/v1/teams/${teamId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update team");
  }
  return res.json();
}

export async function deleteTeam(
  teamId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/teams/${teamId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete team");
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function getTasks(
  token: string,
  filters?: TaskFilters
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.owner_id) params.set("owner_id", filters.owner_id);
  if (filters?.project_id) params.set("project_id", filters.project_id);
  if (filters?.sort_by) params.set("sort_by", filters.sort_by);
  if (filters?.include_archived) params.set("include_archived", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_URL}/api/v1/tasks${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch tasks");
  }
  return res.json();
}

export async function createTask(
  data: TaskCreate,
  token: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/api/v1/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create task");
  }
  return res.json();
}

export async function updateTask(
  taskId: string,
  data: TaskUpdate,
  token: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update task");
  }
  return res.json();
}

export async function archiveTask(
  taskId: string,
  token: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/archive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to archive task");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getProjects(
  token: string,
  includeArchived?: boolean
): Promise<Project[]> {
  const params = includeArchived ? "?include_archived=true" : "";
  const res = await fetch(`${API_URL}/api/v1/projects${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch projects");
  }
  return res.json();
}

export async function getProject(
  projectId: string,
  token: string
): Promise<ProjectDetail> {
  const res = await fetch(`${API_URL}/api/v1/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch project");
  }
  return res.json();
}

export async function createProject(
  data: ProjectCreate,
  token: string
): Promise<Project> {
  const res = await fetch(`${API_URL}/api/v1/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create project");
  }
  return res.json();
}

export async function updateProject(
  projectId: string,
  data: ProjectUpdate,
  token: string
): Promise<Project> {
  const res = await fetch(`${API_URL}/api/v1/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update project");
  }
  return res.json();
}

export async function archiveProject(
  projectId: string,
  token: string
): Promise<Project> {
  const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/archive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to archive project");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Meeting-Project Linking
// ---------------------------------------------------------------------------

export async function linkMeetingToProject(
  meetingId: string,
  projectId: string | null,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/meetings/${meetingId}/project`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to link meeting to project");
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchMeetings(
  query: string,
  token: string,
  filters?: SearchFilters
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (filters?.meeting_type) params.set("meeting_type", filters.meeting_type);
  const res = await fetch(`${API_URL}/api/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Search failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Calendar & Google OAuth
// ---------------------------------------------------------------------------

export async function getGoogleAuthUrl(
  token: string
): Promise<{ url: string }> {
  const res = await fetch(`${API_URL}/api/v1/calendar/auth-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to get auth URL");
  }
  return res.json();
}

export async function connectGoogle(
  code: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/calendar/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to connect Google");
  }
}

export async function getGoogleStatus(
  token: string
): Promise<GoogleConnectionStatus> {
  const res = await fetch(`${API_URL}/api/v1/calendar/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to get Google status");
  }
  return res.json();
}

export async function disconnectGoogle(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/calendar/disconnect`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to disconnect Google");
  }
}

export async function syncCalendar(
  token: string
): Promise<CalendarSyncResponse> {
  const res = await fetch(`${API_URL}/api/v1/calendar/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to sync calendar");
  }
  return res.json();
}

export async function getCalendarEvents(
  token: string
): Promise<CalendarEvent[]> {
  const res = await fetch(`${API_URL}/api/v1/calendar/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch calendar events");
  }
  return res.json();
}

export async function getUpcomingEvents(
  token: string
): Promise<CalendarEvent[]> {
  const res = await fetch(`${API_URL}/api/v1/calendar/events/upcoming`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch upcoming events");
  }
  return res.json();
}

export async function getCalendarMatches(
  meetingId: string,
  token: string
): Promise<CalendarMatchSuggestion[]> {
  const res = await fetch(
    `${API_URL}/api/v1/calendar/match/${meetingId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to get calendar matches");
  }
  return res.json();
}

export async function linkCalendarEvent(
  meetingId: string,
  calendarEventId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/calendar/link/${meetingId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ calendar_event_id: calendarEventId }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to link calendar event");
  }
}

export async function unlinkCalendarEvent(
  meetingId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/calendar/unlink/${meetingId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to unlink calendar event");
  }
}

// ---------------------------------------------------------------------------
// Gmail / Email Threads
// ---------------------------------------------------------------------------

export async function getGmailThreads(
  token: string
): Promise<GmailThread[]> {
  const res = await fetch(`${API_URL}/api/v1/email/threads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch email threads");
  }
  const data = await res.json();
  return data.threads;
}

export async function getGmailThread(
  threadId: string,
  token: string
): Promise<GmailThreadDetail> {
  const res = await fetch(`${API_URL}/api/v1/email/threads/${threadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch email thread");
  }
  return res.json();
}

export async function importEmailThread(
  threadId: string,
  token: string
): Promise<MeetingUploadResponse> {
  const res = await fetch(
    `${API_URL}/api/v1/email/threads/${threadId}/import`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to import email thread");
  }
  return res.json();
}
