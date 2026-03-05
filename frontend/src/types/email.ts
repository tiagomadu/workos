export interface GmailThread {
  thread_id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  message_count: number;
}

export interface GmailThreadDetail {
  thread_id: string;
  subject: string;
  messages: GmailMessage[];
}

export interface GmailMessage {
  message_id: string;
  from_address: string;
  date: string;
  subject: string;
  body: string;
}
