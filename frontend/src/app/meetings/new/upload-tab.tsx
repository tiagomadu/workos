"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadTabProps {
  onFileSelected: (file: File, text: string) => void;
}

const MAX_FILE_SIZE = 512_000; // 512 KB

export function UploadTab({ onFileSelected }: UploadTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndRead = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.endsWith(".txt")) {
        setError("Only .txt files are accepted.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("File size must be 512 KB or less.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        onFileSelected(file, text);
      };
      reader.onerror = () => {
        setError("Failed to read file.");
      };
      reader.readAsText(file);
    },
    [onFileSelected]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndRead(file);
      }
    },
    [validateAndRead]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndRead(file);
      }
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [validateAndRead]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }`}
      >
        <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="mb-2 text-sm text-muted-foreground">
          Drag &amp; drop your .txt file here
        </p>
        <p className="mb-4 text-xs text-muted-foreground">or</p>
        <Button
          variant="outline"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
