import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadTranscript, pasteTranscript, getMeeting } from "@/lib/api";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("uploadTranscript sends multipart with auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ meeting_id: "123", status: "pending" }),
    });
    const file = new File(["test content"], "test.txt", {
      type: "text/plain",
    });
    const result = await uploadTranscript(file, "test-token");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/meetings/upload"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
    expect(result.meeting_id).toBe("123");
  });

  it("uploadTranscript includes metadata in form data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ meeting_id: "456", status: "pending" }),
    });
    const file = new File(["content"], "notes.txt", { type: "text/plain" });
    await uploadTranscript(file, "token", {
      title: "Team Standup",
      meeting_date: "2026-03-04",
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = callArgs[1].body as FormData;
    expect(body.get("title")).toBe("Team Standup");
    expect(body.get("meeting_date")).toBe("2026-03-04");
  });

  it("pasteTranscript sends JSON with auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ meeting_id: "789", status: "pending" }),
    });
    const result = await pasteTranscript("transcript text", "test-token", {
      title: "Quick Sync",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/meetings/paste"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
      })
    );
    expect(result.meeting_id).toBe("789");
  });

  it("getMeeting returns parsed meeting data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "123",
          status: "completed",
          created_at: "2026-03-04",
        }),
    });
    const meeting = await getMeeting("123", "test-token");
    expect(meeting.id).toBe("123");
    expect(meeting.status).toBe("completed");
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: "Not found" }),
    });
    await expect(getMeeting("bad", "token")).rejects.toThrow("Not found");
  });

  it("throws generic message when error response has no JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.reject(new Error("no json")),
    });
    await expect(getMeeting("bad", "token")).rejects.toThrow(
      "Failed to fetch meeting"
    );
  });

  it("uploadTranscript throws on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: "Invalid file" }),
    });
    const file = new File(["x"], "test.txt", { type: "text/plain" });
    await expect(uploadTranscript(file, "token")).rejects.toThrow(
      "Invalid file"
    );
  });

  it("pasteTranscript throws on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: "Text too long" }),
    });
    await expect(pasteTranscript("text", "token")).rejects.toThrow(
      "Text too long"
    );
  });
});
