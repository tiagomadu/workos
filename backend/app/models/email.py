"""Pydantic models for email-related requests and responses."""

from pydantic import BaseModel
from typing import Optional


class GmailThread(BaseModel):
    thread_id: str
    subject: str
    sender: str
    date: str
    snippet: str
    message_count: int


class GmailMessage(BaseModel):
    message_id: str
    from_address: str
    date: str
    subject: str
    body: str


class GmailThreadDetail(BaseModel):
    thread_id: str
    subject: str
    messages: list[GmailMessage]


class EmailImportResponse(BaseModel):
    meeting_id: str
    status: str
