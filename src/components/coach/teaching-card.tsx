"use client";

import { ClassificationBadge } from "@/components/coach/classification-badge";
import { HintLadder } from "@/components/coach/hint-ladder";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { HintStep, TeachingInsight } from "@/domain/teaching";

export type TeachingCardProps = {
  insight: TeachingInsight | null;
  analyzing?: boolean;
  onTrySuggested?: () => void;
  onTakebackRetry: () => void;
  canTakebackRetry: boolean;
  hint?: HintStep | null;
  hintDisabled?: boolean;
  onRequestHint?: () => void;
  /** FEN for converting hint UCI lines to SAN. */
  hintFen?: string | null;
  showTutorLaneHint?: boolean;
};

/**
 * Expanded coach detail content (explanation, actions, hints).
 * Mounted inside CoachRail's upward-floating panel.
 */
export function TeachingCard({
  insight,
  analyzing = false,
  onTrySuggested,
  onTakebackRetry,
  canTakebackRetry,
  hint = null,
  hintDisabled = false,
  onRequestHint,
  hintFen = null,
  showTutorLaneHint = false,
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
      <div
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
      </div>
    );
  }

  if (!insight) {
    return (
      <div
        className="flex flex-col gap-2"
        data-testid="teaching-card"
        data-state="empty"
        role="region"
        aria-labelledby="coach-expanded-title"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 id="coach-expanded-title" className="text-sm font-medium">
              Coach
            </h3>
            <p className="text-xs text-muted-foreground">
              Feedback appears after each move.
            </p>
          </div>
        </div>
        {hintLadder}
      </div>
    );
  }

  return (
    <div
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
      {insight.suggestedMoveSan ? (
        <p className="text-sm" data-testid="suggested-move">
          <span className="text-muted-foreground">Try instead: </span>
          <span className="font-medium">{insight.suggestedMoveSan}</span>
        </p>
      ) : null}
      {showTutorLaneHint ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="tutor-lane-hint"
        >
          Alternate line shown on the timeline (dashed diamond).
        </p>
      ) : null}
      {hintLadder}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {onTrySuggested && insight.suggestedMoveUci ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onTrySuggested}
            data-testid="explore-line-button"
          >
            Try from here
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!canTakebackRetry}
          onClick={onTakebackRetry}
          data-testid="takeback-retry-button"
        >
          Undo my move
        </Button>
      </div>
    </div>
  );
}
