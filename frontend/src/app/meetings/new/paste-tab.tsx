"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PasteTabProps {
  onTextSubmitted: (text: string) => void;
}

const MAX_PASTE_SIZE = 500 * 1024; // 500 KB

export function PasteTab({ onTextSubmitted }: PasteTabProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    setError(null);

    if (!text.trim()) {
      setError("Please enter some transcript text.");
      return;
    }

    if (new Blob([text]).size > MAX_PASTE_SIZE) {
      setError("Text must be under 500 KB.");
      return;
    }

    onTextSubmitted(text);
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your meeting transcript here..."
        className="min-h-[300px] font-mono"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={!text.trim()}>
          Continue
        </Button>
      </div>
    </div>
  );
}
