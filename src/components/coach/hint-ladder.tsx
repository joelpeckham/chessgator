"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { lineUciToSan } from "@/domain/game";
import { type HintStep, nextHintActionLabel } from "@/domain/teaching";

export type HintLadderProps = {
  hint: HintStep | null;
  fen?: string | null;
  disabled?: boolean;
  onRequestHint: () => void;
};

/**
 * Progressive hints: squares (on the board) → candidate → short line.
 */
export function HintLadder({
  hint,
  fen = null,
  disabled = false,
  onRequestHint,
}: HintLadderProps) {
  const level = hint?.level ?? -1;
  const lineSan =
    hint && hint.level >= 3 ? lineUciToSan(fen, hint.lineUci) : "";
  const showButton = level < 3;

  return (
    <div
      className="flex flex-col gap-2"
      aria-label="Progressive hints"
      data-testid="hint-ladder"
      data-hint-level={hint?.level ?? "none"}
    >
      {hint ? (
        <motion.div
          key={hint.level}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="text-sm"
          data-testid="hint-content"
          data-hint-level={hint.level}
        >
          {hint.question ? (
            <p data-testid="hint-question">{hint.question}</p>
          ) : null}
          {hint.level >= 1 && hint.highlightSquares.length > 0 ? (
            <p className="sr-only" data-testid="hint-squares">
              Focus squares: {hint.highlightSquares.join(", ")} (also marked on
              the board with dashed outlines)
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
        </motion.div>
      ) : null}
      {showButton ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onRequestHint}
          data-testid="hint-button"
        >
          {nextHintActionLabel(level)}
        </Button>
      ) : null}
    </div>
  );
}
