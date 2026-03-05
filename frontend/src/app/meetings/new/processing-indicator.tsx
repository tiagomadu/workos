"use client";

import {
  Loader2,
  CheckCircle,
  Circle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Meeting } from "@/types/meeting";

interface ProcessingIndicatorProps {
  status: Meeting["status"];
  processingStep?: Meeting["processing_step"];
  errorMessage?: string;
  llmProvider?: string;
  onRetry?: () => void;
}

const STEPS = [
  { key: "detecting_type", label: "Detecting meeting type..." },
  { key: "suggesting_project", label: "Matching to project..." },
  { key: "summarizing", label: "Generating summary..." },
  { key: "extracting_actions", label: "Extracting action items..." },
  { key: "resolving_owners", label: "Resolving action item owners..." },
  { key: "generating_embeddings", label: "Indexing for search..." },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const STEP_ORDER: StepKey[] = [
  "detecting_type",
  "suggesting_project",
  "summarizing",
  "extracting_actions",
  "resolving_owners",
  "generating_embeddings",
];

function getStepState(
  stepKey: StepKey,
  meetingStatus: Meeting["status"],
  processingStep?: Meeting["processing_step"],
): "active" | "completed" | "pending" {
  // Completed meeting: all steps done
  if (meetingStatus === "completed") return "completed";

  // Failed: mark steps before the current step as completed, current as pending
  if (meetingStatus === "failed") {
    if (!processingStep) return "pending";
    const currentIdx = STEP_ORDER.indexOf(processingStep as StepKey);
    const stepIdx = STEP_ORDER.indexOf(stepKey);
    if (currentIdx === -1) return "pending";
    if (stepIdx < currentIdx) return "completed";
    return "pending";
  }

  // Processing: use processing_step to determine progress
  if (meetingStatus === "processing" && processingStep) {
    const currentIdx = STEP_ORDER.indexOf(processingStep as StepKey);
    const stepIdx = STEP_ORDER.indexOf(stepKey);

    if (currentIdx === -1) return "pending";
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  }

  // uploaded / pending / no step yet — all pending
  return "pending";
}

export function ProcessingIndicator({
  status,
  processingStep,
  errorMessage,
  llmProvider,
  onRetry,
}: ProcessingIndicatorProps) {
  const isFailed = status === "failed";
  const isComplete = status === "completed";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {STEPS.map((step) => {
          const state = getStepState(step.key, status, processingStep);
          return (
            <div key={step.key} className="flex items-center gap-3">
              {state === "active" && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {state === "completed" && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {state === "pending" && (
                <Circle className="h-5 w-5 text-muted-foreground/40" />
              )}
              <span
                className={
                  state === "pending"
                    ? "text-muted-foreground/40"
                    : state === "completed"
                      ? "text-foreground"
                      : "text-foreground font-medium"
                }
              >
                {step.label}
              </span>
            </div>
          );
        })}

        {/* Processing complete row */}
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
          <span
            className={
              isComplete ? "text-foreground font-medium" : "text-muted-foreground/40"
            }
          >
            Processing complete!
          </span>
        </div>
      </div>

      {llmProvider && !isFailed && (
        <p className="text-xs text-muted-foreground">
          Using {llmProvider}
        </p>
      )}

      {isFailed && (
        <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Processing failed</span>
          </div>
          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Your transcript is saved.
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
