"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { tryApplyMove } from "@/domain/game/rules";
import type { HintStep } from "@/domain/teaching";

export type HintLadderProps = {
  hint: HintStep | null;
  fen?: string | null;
  disabled?: boolean;
  onRequestHint: () => void;
  /** Compact mode: button only, no body (for coach rail strip). */
  compact?: boolean;
};

function nextHintLabel(level: number): string {
  if (level < 0) return "Get a hint";
  if (level === 0) return "Show key squares";
  if (level === 1) return "Show a candidate";
  if (level === 2) return "Show a short line";
  return "Hints maxed";
}

function lineToSan(fen: string | null | undefined, lineUci: string[]): string {
  if (!fen || lineUci.length === 0) return lineUci.join(" ");
  const sans: string[] = [];
  let cursor = fen;
  for (const uci of lineUci) {
    const applied = tryApplyMove(cursor, uci);
    if (!applied) {
      sans.push(uci);
      break;
    }
    sans.push(applied.move.san);
    cursor = applied.fenAfter;
  }
  return sans.join(" ");
}

/**
 * Progressive hint ladder: question → squares → candidate → short line.
 */
export function HintLadder({
  hint,
  fen = null,
  disabled = false,
  onRequestHint,
  compact = false,
}: HintLadderProps) {
  const level = hint?.level ?? -1;
  const nextLabel = nextHintLabel(level);
  const lineSan = useMemo(
    () => (hint && hint.level >= 3 ? lineToSan(fen, hint.lineUci) : ""),
    [fen, hint],
  );

  if (compact) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={disabled || level >= 3}
        onClick={onRequestHint}
        data-testid="hint-button"
      >
        {level < 0 ? "Hint" : nextLabel}
      </Button>
    );
  }

  return (
    <div
      className="flex flex-col gap-2"
      aria-label="Progressive hints"
      data-testid="hint-ladder"
      data-hint-level={hint?.level ?? "none"}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {hint ? `Hint ${hint.level + 1} of 4` : "Hints"}
        </p>
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
          className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm"
          data-testid="hint-content"
          data-hint-level={hint.level}
        >
          <p data-testid="hint-question">{hint.question}</p>
          {hint.level >= 1 && hint.highlightSquares.length > 0 ? (
            <p
              className="mt-1 text-xs text-muted-foreground"
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
            <p className="mt-1 font-medium" data-testid="hint-candidate">
              Candidate: {hint.candidateMoveSan}
            </p>
          ) : null}
          {hint.level >= 3 && hint.lineUci.length > 0 ? (
            <p className="mt-1 font-mono text-xs" data-testid="hint-line">
              Line: {lineSan}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Progressive hints: question, squares, candidate, then a short line.
        </p>
      )}
    </div>
  );
}
