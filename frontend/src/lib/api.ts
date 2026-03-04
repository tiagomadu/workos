import type {
  ActionItem,
  Meeting,
  MeetingSummary,
  MeetingUploadResponse,
} from "@/types/meeting";

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
