"use client";

import type { HintStep } from "@/domain/teaching";
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
    <section
      aria-label="Progressive hints"
      className="flex flex-col gap-2"
      data-testid="hint-ladder"
      data-hint-level={hint?.level ?? "none"}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">Hints</h2>
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
        <div
          className="rounded-2xl bg-muted/50 p-3 text-sm"
          data-testid="hint-content"
        >
          <p data-testid="hint-question">{hint.question}</p>
          {hint.level >= 1 && hint.highlightSquares.length > 0 ? (
            <p
              className="mt-2 text-xs text-muted-foreground"
              data-testid="hint-squares"
            >
              Focus squares: {hint.highlightSquares.join(", ")}
              <span className="sr-only">
                {" "}
                (also marked on the board with dashed outlines)
              </span>
            </p>
          ) : null}
          {hint.level >= 2 && hint.candidateMoveSan ? (
            <p className="mt-2 font-medium" data-testid="hint-candidate">
              Candidate: {hint.candidateMoveSan}
            </p>
          ) : null}
          {hint.level >= 3 && hint.lineUci.length > 0 ? (
            <p
              className="mt-2 font-mono text-xs"
              data-testid="hint-line"
            >
              Line: {hint.lineUci.join(" ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Progressive hints: question, squares, candidate, then a short line.
        </p>
      )}
    </section>
  );
}
