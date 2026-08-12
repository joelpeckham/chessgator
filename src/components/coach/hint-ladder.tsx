"use client";

import type { HintStep } from "@/domain/teaching";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type HintLadderProps = {
  hint: HintStep | null;
  disabled?: boolean;
  onRequestHint: () => void;
};

export function HintLadder({
  hint,
  disabled = false,
  onRequestHint,
}: HintLadderProps) {
  const level = hint?.level ?? -1;
  const nextLabel =
    level < 0
      ? "Get a hint"
      : level === 0
        ? "Show key squares"
        : level === 1
          ? "Show a candidate"
          : level === 2
            ? "Show a short line"
            : "Hints maxed";

  return (
    <Alert
      className="shadow-none"
      aria-label="Progressive hints"
      data-testid="hint-ladder"
      data-hint-level={hint?.level ?? "none"}
    >
      <div className="col-span-full flex items-center justify-between gap-2">
        <AlertTitle className="mb-0">Hints</AlertTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || level >= 3}
          onClick={onRequestHint}
          data-testid="hint-button"
        >
          {nextLabel}
        </Button>
      </div>
      {hint ? (
        <AlertDescription className="col-span-full" data-testid="hint-content">
          <p data-testid="hint-question">{hint.question}</p>
          {hint.level >= 1 && hint.highlightSquares.length > 0 ? (
            <p className="mt-1.5 text-xs" data-testid="hint-squares">
              Focus squares: {hint.highlightSquares.join(", ")}
              <span className="sr-only">
                {" "}
                (also marked on the board with dashed outlines)
              </span>
            </p>
          ) : null}
          {hint.level >= 2 && hint.candidateMoveSan ? (
            <p className="mt-1.5 font-medium text-foreground" data-testid="hint-candidate">
              Candidate: {hint.candidateMoveSan}
            </p>
          ) : null}
          {hint.level >= 3 && hint.lineUci.length > 0 ? (
            <p className="mt-1.5 font-mono text-xs" data-testid="hint-line">
              Line: {hint.lineUci.join(" ")}
            </p>
          ) : null}
        </AlertDescription>
      ) : (
        <AlertDescription className="col-span-full">
          Progressive hints: question, squares, candidate, then a short line.
        </AlertDescription>
      )}
    </Alert>
  );
}
