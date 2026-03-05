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
