"use client";

import { motion } from "motion/react";
import { ClassificationBadge } from "@/components/coach/classification-badge";
import { HintLadder } from "@/components/coach/hint-ladder";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { HintStep, TeachingInsight } from "@/domain/teaching";

const STATE_FADE = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

export type TeachingCardProps = {
  insight: TeachingInsight | null;
  analyzing?: boolean;
  onTrySuggested?: () => void;
  hint?: HintStep | null;
  hintDisabled?: boolean;
  onRequestHint?: () => void;
  /** FEN for converting hint UCI lines to SAN. */
  hintFen?: string | null;
  emptyCopy?: string | null;
};

/**
 * Expanded coach detail content (explanation, actions, hints).
 * Mounted inside the mascot speech balloon.
 */
export function TeachingCard({
  insight,
  analyzing = false,
  onTrySuggested,
  hint = null,
  hintDisabled = false,
  onRequestHint,
  hintFen = null,
  emptyCopy = null,
}: TeachingCardProps) {
  const showHints = Boolean(onRequestHint) || Boolean(hint);
  const hintLadder = showHints ? (
    <HintLadder
      hint={hint}
      fen={hintFen}
      disabled={hintDisabled || !onRequestHint}
      onRequestHint={onRequestHint ?? (() => undefined)}
    />
  ) : null;

  if (analyzing) {
    return (
      <motion.div
        key="analyzing"
        {...STATE_FADE}
        className="flex items-start gap-2"
        data-testid="teaching-card"
        data-state="analyzing"
        role="region"
        aria-labelledby="coach-expanded-title"
      >
        <Spinner />
        <div>
          <h3 id="coach-expanded-title" className="text-sm font-medium">
            Coach
          </h3>
          <p className="text-sm text-muted-foreground">Analyzing your move…</p>
        </div>
      </motion.div>
    );
  }

  if (hint) {
    return (
      <motion.div
        key={`hint:${hint.level}:${hint.question}`}
        {...STATE_FADE}
        className="flex flex-col gap-2"
        data-testid="teaching-card"
        data-state="hints"
        role="region"
        aria-labelledby="coach-expanded-title"
      >
        <h3 id="coach-expanded-title" className="text-sm font-medium">
          Coach
        </h3>
        {hintLadder}
      </motion.div>
    );
  }

  if (!insight) {
    return (
      <motion.div
        key="empty"
        {...STATE_FADE}
        className="flex flex-col gap-2"
        data-testid="teaching-card"
        data-state="empty"
        role="region"
        aria-labelledby="coach-expanded-title"
      >
        <div className="min-w-0">
          <h3 id="coach-expanded-title" className="text-sm font-medium">
            Coach
          </h3>
          <p className="text-xs text-muted-foreground">
            {emptyCopy ?? "Feedback appears after each move."}
          </p>
        </div>
        {hintLadder}
      </motion.div>
    );
  }

  const tryLabel = insight.suggestedMoveSan
    ? `Try ${insight.suggestedMoveSan}`
    : "Try this move";

  return (
    <motion.div
      key={`feedback:${insight.classification}:${insight.explanation}`}
      {...STATE_FADE}
      className="flex flex-col gap-2"
      data-testid="teaching-card"
      data-state="feedback"
      data-classification={insight.classification}
      data-concept={insight.concept}
      role="region"
      aria-labelledby="coach-expanded-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="coach-expanded-title" className="text-sm font-medium">
          Coach
        </h3>
        <ClassificationBadge insight={insight} testId="classification-badge" />
      </div>
      <p className="text-sm text-pretty" data-testid="teaching-explanation">
        {insight.explanation}
      </p>
      {onTrySuggested || (onRequestHint && !hintDisabled) ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {onTrySuggested ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onTrySuggested}
              data-testid="explore-line-button"
            >
              {tryLabel}
            </Button>
          ) : null}
          {onRequestHint && !hintDisabled ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRequestHint}
              data-testid="hint-button"
            >
              Hint
            </Button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
