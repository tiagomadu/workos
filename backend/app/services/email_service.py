"""Email service — fetches Gmail threads and imports them as meetings."""

import base64
import logging
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from io import StringIO

import httpx

from app.core.google_oauth import get_valid_token
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


class _HTMLTextExtractor(HTMLParser):
    """Minimal HTML-to-text converter that strips tags."""

    def __init__(self) -> None:
        super().__init__()
        self._result = StringIO()

    def handle_data(self, data: str) -> None:
        self._result.write(data)

    def get_text(self) -> str:
        return self._result.getvalue()


def _strip_html(html: str) -> str:
    """Strip HTML tags and return plain text."""
    extractor = _HTMLTextExtractor()
    extractor.feed(html)
    return extractor.get_text()


def _get_header(headers: list[dict], name: str) -> str:
    """Extract a header value by name from a list of Gmail header dicts."""
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _decode_body(data: str) -> str:
    """Decode a base64url-encoded Gmail message body."""
    if not data:
        return ""
    # Gmail uses URL-safe base64 without padding
    padded = data + "=" * (4 - len(data) % 4)
    try:
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        logger.warning("Failed to decode message body")
        return ""


def _extract_body(payload: dict) -> str:
    """Extract the text body from a Gmail message payload.

    Prefers text/plain; falls back to text/html with tag stripping.
    Recursively searches multipart messages.
    """
    mime_type = payload.get("mimeType", "")

    # Direct body on this part
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == "text/plain" and body_data:
        return _decode_body(body_data)

    # Check sub-parts (multipart messages)
    parts = payload.get("parts", [])

    # First pass: look for text/plain
    for part in parts:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return _decode_body(data)

    # Second pass: look for text/html and strip tags
    for part in parts:
        if part.get("mimeType") == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                return _strip_html(_decode_body(data))

    # Recursive: check nested multipart parts
    for part in parts:
        nested = _extract_body(part)
        if nested:
            return nested

    # Last resort: decode whatever body data exists
    if body_data:
        decoded = _decode_body(body_data)
        if mime_type.startswith("text/html"):
            return _strip_html(decoded)
        return decoded

    return ""


async def list_gmail_threads(user_id: str, max_results: int = 20) -> list[dict]:
    """List recent Gmail threads from the user's inbox.

    Returns a list of thread dicts with: thread_id, subject, sender, date,
    snippet, message_count. Sorted by date descending.
    """
    access_token = await get_valid_token(user_id)

    async with httpx.AsyncClient() as client:
        # Step 1: Get thread IDs
        resp = await client.get(
            f"{GMAIL_API_BASE}/threads",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"maxResults": max_results, "labelIds": "INBOX"},
        )
        resp.raise_for_status()
        data = resp.json()

        threads_raw = data.get("threads", [])
        if not threads_raw:
            return []

        # Step 2: Fetch metadata for each thread
        results = []
        for t in threads_raw:
            tid = t["id"]
            detail_resp = await client.get(
                f"{GMAIL_API_BASE}/threads/{tid}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "format": "metadata",
                    "metadataHeaders": ["Subject", "From", "Date"],
                },
            )
            detail_resp.raise_for_status()
            detail = detail_resp.json()

            messages = detail.get("messages", [])
            if not messages:
                continue

            # Extract headers from the first message
            first_msg = messages[0]
            headers = first_msg.get("payload", {}).get("headers", [])

            subject = _get_header(headers, "Subject") or "(no subject)"
            sender = _get_header(headers, "From") or "(unknown)"
            date = _get_header(headers, "Date") or ""

            results.append({
                "thread_id": tid,
                "subject": subject,
                "sender": sender,
                "date": date,
                "snippet": detail.get("snippet", ""),
                "message_count": len(messages),
            })

    # Sort by date descending (most recent first)
    results.sort(key=lambda x: x["date"], reverse=True)
    return results


async def get_gmail_thread(user_id: str, thread_id: str) -> dict:
    """Fetch the full content of a Gmail thread.

    Returns a GmailThreadDetail-compatible dict with thread_id, subject,
    and a list of messages (each with message_id, from_address, date,
    subject, body).
    """
    access_token = await get_valid_token(user_id)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GMAIL_API_BASE}/threads/{thread_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"format": "full"},
        )
        resp.raise_for_status()
        data = resp.json()

    messages_raw = data.get("messages", [])
    thread_subject = ""
    messages = []

    for msg in messages_raw:
        payload = msg.get("payload", {})
        headers = payload.get("headers", [])

        msg_subject = _get_header(headers, "Subject") or "(no subject)"
        from_address = _get_header(headers, "From") or "(unknown)"
        date = _get_header(headers, "Date") or ""
        body = _extract_body(payload)

        if not thread_subject:
            thread_subject = msg_subject

        messages.append({
            "message_id": msg.get("id", ""),
            "from_address": from_address,
            "date": date,
            "subject": msg_subject,
            "body": body,
        })

    return {
        "thread_id": thread_id,
        "subject": thread_subject,
        "messages": messages,
    }


def normalise_email_thread(messages: list[dict]) -> str:
    """Convert a list of email messages into a normalised transcript string.

    Each message is formatted as:
        From: sender@email.com
        Date: 2026-03-04 10:30 AM
        Subject: Re: Project Update

        Message body text here...

        ---

    Messages are joined with '---' separators. Excessive whitespace
    and blank lines are collapsed.
    """
    if not messages:
        return ""

    blocks = []
    for msg in messages:
        from_addr = msg.get("from_address", "").strip()
        date = msg.get("date", "").strip()
        subject = msg.get("subject", "").strip()
        body = msg.get("body", "").strip()

        # Collapse excessive internal whitespace (3+ consecutive newlines -> 2)
        body = re.sub(r"\n{3,}", "\n\n", body)
        # Normalise line endings
        body = body.replace("\r\n", "\n").replace("\r", "\n")

        header = f"From: {from_addr}\nDate: {date}\nSubject: {subject}"
        block = f"{header}\n\n{body}"
        blocks.append(block)

    return "\n\n---\n\n".join(blocks)


async def import_email_as_meeting(user_id: str, thread_id: str) -> str:
    """Import a Gmail thread as a meeting record and return the meeting ID.

    Fetches the thread, normalises it into a transcript, and inserts
    a new meeting record with meeting_type='email_thread' and status='pending'.
    """
    thread_detail = await get_gmail_thread(user_id, thread_id)
    messages = thread_detail.get("messages", [])
    subject = thread_detail.get("subject", "(no subject)")

    normalised_text = normalise_email_thread(messages)

    # Extract date from first message, fall back to now
    meeting_date = None
    if messages:
        raw_date = messages[0].get("date", "")
        if raw_date:
            # Try to parse the email date; use as-is if it fails
            try:
                # Email dates can be complex; store the raw string
                meeting_date = raw_date
            except Exception:
                meeting_date = datetime.now(timezone.utc).isoformat()

    if not meeting_date:
        meeting_date = datetime.now(timezone.utc).isoformat()

    supabase = get_supabase_client()
    result = (
        supabase.table("meetings")
        .insert(
            {
                "user_id": user_id,
                "title": f"Email: {subject}",
                "meeting_date": meeting_date,
                "meeting_type": "email_thread",
                "raw_transcript": normalised_text,
                "status": "pending",
            }
        )
        .execute()
    )

    return result.data[0]["id"]
