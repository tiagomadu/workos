"""Tests for email models and email_service normalisation logic."""

import pytest

from app.models.email import (
    EmailImportResponse,
    GmailMessage,
    GmailThread,
    GmailThreadDetail,
)
from app.services.email_service import normalise_email_thread


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------

class TestGmailThreadSchema:
    def test_validates_correctly(self):
        """GmailThread schema validates with all required fields."""
        thread = GmailThread(
            thread_id="t-001",
            subject="Weekly Sync",
            sender="alice@example.com",
            date="Mon, 03 Mar 2026 09:00:00 -0500",
            snippet="Let's discuss the roadmap...",
            message_count=3,
        )
        assert thread.thread_id == "t-001"
        assert thread.subject == "Weekly Sync"
        assert thread.sender == "alice@example.com"
        assert thread.date == "Mon, 03 Mar 2026 09:00:00 -0500"
        assert thread.snippet == "Let's discuss the roadmap..."
        assert thread.message_count == 3


class TestGmailThreadDetailSchema:
    def test_validates_correctly(self):
        """GmailThreadDetail schema validates with nested messages."""
        detail = GmailThreadDetail(
            thread_id="t-002",
            subject="Project Update",
            messages=[
                GmailMessage(
                    message_id="m-001",
                    from_address="bob@example.com",
                    date="Tue, 04 Mar 2026 10:30:00 -0500",
                    subject="Project Update",
                    body="Here is the update.",
                ),
                GmailMessage(
                    message_id="m-002",
                    from_address="carol@example.com",
                    date="Tue, 04 Mar 2026 11:00:00 -0500",
                    subject="Re: Project Update",
                    body="Thanks for the update!",
                ),
            ],
        )
        assert detail.thread_id == "t-002"
        assert detail.subject == "Project Update"
        assert len(detail.messages) == 2
        assert detail.messages[0].message_id == "m-001"
        assert detail.messages[1].from_address == "carol@example.com"


class TestGmailMessageSchema:
    def test_validates_correctly(self):
        """GmailMessage schema validates with all required fields."""
        msg = GmailMessage(
            message_id="m-100",
            from_address="dave@example.com",
            date="Wed, 05 Mar 2026 14:00:00 +0000",
            subject="Quick Question",
            body="What time is the meeting?",
        )
        assert msg.message_id == "m-100"
        assert msg.from_address == "dave@example.com"
        assert msg.date == "Wed, 05 Mar 2026 14:00:00 +0000"
        assert msg.subject == "Quick Question"
        assert msg.body == "What time is the meeting?"


class TestEmailImportResponseSchema:
    def test_validates_correctly(self):
        """EmailImportResponse schema validates with required fields."""
        resp = EmailImportResponse(
            meeting_id="mtg-abc-123",
            status="pending",
        )
        assert resp.meeting_id == "mtg-abc-123"
        assert resp.status == "pending"


# ---------------------------------------------------------------------------
# normalise_email_thread tests
# ---------------------------------------------------------------------------

class TestNormaliseEmailThread:
    def test_multiple_messages(self):
        """normalise_email_thread concatenates multiple messages with headers and separators."""
        messages = [
            {
                "from_address": "alice@example.com",
                "date": "Mon, 03 Mar 2026 09:00:00 -0500",
                "subject": "Project Update",
                "body": "Here is the latest update on the project.",
            },
            {
                "from_address": "bob@example.com",
                "date": "Mon, 03 Mar 2026 10:00:00 -0500",
                "subject": "Re: Project Update",
                "body": "Thanks Alice, looks great!",
            },
        ]
        result = normalise_email_thread(messages)

        # Check both messages are present
        assert "From: alice@example.com" in result
        assert "From: bob@example.com" in result
        assert "Here is the latest update on the project." in result
        assert "Thanks Alice, looks great!" in result

        # Check separator between messages
        assert "\n\n---\n\n" in result

        # Check headers for first message
        assert "Date: Mon, 03 Mar 2026 09:00:00 -0500" in result
        assert "Subject: Project Update" in result

    def test_single_message(self):
        """normalise_email_thread handles single message correctly."""
        messages = [
            {
                "from_address": "eve@example.com",
                "date": "Tue, 04 Mar 2026 08:00:00 +0000",
                "subject": "Hello",
                "body": "Just checking in.",
            },
        ]
        result = normalise_email_thread(messages)

        assert "From: eve@example.com" in result
        assert "Date: Tue, 04 Mar 2026 08:00:00 +0000" in result
        assert "Subject: Hello" in result
        assert "Just checking in." in result

        # No separator when there's only one message
        assert "---" not in result

    def test_strips_excessive_whitespace(self):
        """normalise_email_thread strips excessive whitespace from message bodies."""
        messages = [
            {
                "from_address": "frank@example.com",
                "date": "Wed, 05 Mar 2026 12:00:00 +0000",
                "subject": "Spacing Test",
                "body": "Line one.\n\n\n\n\nLine two.\n\n\n\n\n\nLine three.",
            },
        ]
        result = normalise_email_thread(messages)

        # Excessive newlines (3+) should be collapsed to 2
        assert "Line one.\n\nLine two.\n\nLine three." in result
        assert "\n\n\n" not in result

    def test_empty_message_list(self):
        """normalise_email_thread handles empty message list."""
        result = normalise_email_thread([])
        assert result == ""

    def test_preserves_sender_date_subject(self):
        """normalise_email_thread preserves sender, date, subject in output."""
        messages = [
            {
                "from_address": "Grace Hopper <grace@navy.mil>",
                "date": "Thu, 06 Mar 2026 15:30:00 -0800",
                "subject": "Bug Report: First Computer Bug",
                "body": "Found an actual bug in the relay.",
            },
        ]
        result = normalise_email_thread(messages)

        assert "From: Grace Hopper <grace@navy.mil>" in result
        assert "Date: Thu, 06 Mar 2026 15:30:00 -0800" in result
        assert "Subject: Bug Report: First Computer Bug" in result
        assert "Found an actual bug in the relay." in result

    def test_normalises_line_endings(self):
        """normalise_email_thread normalises \\r\\n and \\r to \\n."""
        messages = [
            {
                "from_address": "hal@example.com",
                "date": "Fri, 07 Mar 2026 09:00:00 +0000",
                "subject": "Line Endings",
                "body": "Line A.\r\nLine B.\rLine C.",
            },
        ]
        result = normalise_email_thread(messages)

        assert "\r" not in result
        assert "Line A.\nLine B.\nLine C." in result

    def test_handles_missing_fields_gracefully(self):
        """normalise_email_thread handles messages with missing or empty fields."""
        messages = [
            {
                "from_address": "",
                "date": "",
                "subject": "",
                "body": "",
            },
        ]
        result = normalise_email_thread(messages)

        # Should still produce header lines even if empty
        assert "From:" in result
        assert "Date:" in result
        assert "Subject:" in result

    def test_message_order_preserved(self):
        """normalise_email_thread preserves the order of messages."""
        messages = [
            {
                "from_address": "first@example.com",
                "date": "2026-03-01",
                "subject": "First",
                "body": "Message one.",
            },
            {
                "from_address": "second@example.com",
                "date": "2026-03-02",
                "subject": "Second",
                "body": "Message two.",
            },
            {
                "from_address": "third@example.com",
                "date": "2026-03-03",
                "subject": "Third",
                "body": "Message three.",
            },
        ]
        result = normalise_email_thread(messages)

        # Verify order: first appears before second, second before third
        idx_first = result.index("first@example.com")
        idx_second = result.index("second@example.com")
        idx_third = result.index("third@example.com")
        assert idx_first < idx_second < idx_third
