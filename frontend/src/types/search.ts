export interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

export interface SearchSource {
  meeting_id: string;
  meeting_title?: string;
  meeting_date?: string;
  meeting_type?: string;
  chunk_text: string;
  similarity: number;
}

export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  meeting_type?: string;
}
