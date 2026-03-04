"use client";

interface PreviewPanelProps {
  filename?: string;
  text: string;
  fileSize: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

export function PreviewPanel({ filename, text, fileSize }: PreviewPanelProps) {
  const lines = text.split("\n");
  const previewLines = lines.slice(0, 10);
  const hasMore = lines.length > 10;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">
          {filename ?? "Pasted transcript"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(fileSize)}
        </p>
      </div>
      <pre className="max-h-[300px] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
        {previewLines.join("\n")}
        {hasMore && "\n..."}
      </pre>
    </div>
  );
}
