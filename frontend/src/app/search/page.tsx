"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { searchMeetings } from "@/lib/api";
import type { SearchFilters as SearchFiltersType } from "@/types/search";
import { SearchFilters } from "./search-filters";
import { SearchResultCard } from "./search-result-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";

function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  return token;
}

export default function SearchPage() {
  const token = useAuthToken();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFiltersType>({});

  const searchMutation = useMutation({
    mutationFn: () => searchMeetings(query, token!, filters),
  });

  const handleSearch = () => {
    if (query.trim() && token) {
      searchMutation.mutate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  const result = searchMutation.data;
  const isSearching = searchMutation.isPending;
  const hasSearched = searchMutation.isSuccess || searchMutation.isError;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Search Meetings</h1>
        <p className="mt-1 text-muted-foreground">
          Ask questions about your meeting history
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What decisions were made about...?"
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={!query.trim() || isSearching}>
          {isSearching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <SearchFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Results area */}
      {isSearching && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Searching across your meetings...
          </p>
        </div>
      )}

      {searchMutation.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">
            {searchMutation.error instanceof Error
              ? searchMutation.error.message
              : "Search failed. Please try again."}
          </p>
        </div>
      )}

      {searchMutation.isSuccess && result && (
        <div className="space-y-6">
          {/* Answer card */}
          <Card>
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed">{result.answer}</p>
            </CardContent>
          </Card>

          {/* Sources */}
          {result.sources.length > 0 ? (
            <div>
              <h2 className="mb-4 text-lg font-semibold">
                Sources ({result.sources.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {result.sources.map((source, idx) => (
                  <SearchResultCard
                    key={`${source.meeting_id}-${idx}`}
                    source={source}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No relevant meetings found for your query.
            </p>
          )}
        </div>
      )}

      {!hasSearched && !isSearching && (
        <p className="py-16 text-center text-muted-foreground">
          Type a question to search across your meetings
        </p>
      )}
    </main>
  );
}
