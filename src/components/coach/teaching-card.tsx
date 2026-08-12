"use client";

import type { HintStep, TeachingInsight } from "@/domain/teaching";
import { classificationLabel } from "@/domain/teaching";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type TeachingCardProps = {
  insight: TeachingInsight | null;
  analyzing?: boolean;
  onTrySuggested?: () => void;
  onTakebackRetry: () => void;
  canTakebackRetry: boolean;
  hint?: HintStep | null;
  hintDisabled?: boolean;
  onRequestHint?: () => void;
};

export function TeachingCard({
  insight,
  analyzing = false,
  onTrySuggested,
  onTakebackRetry,
  canTakebackRetry,
  hint = null,
  hintDisabled = false,
  onRequestHint,
}: TeachingCardProps) {
  const level = hint?.level ?? -1;
  const nextHintLabel =
    level < 0
      ? "Hint"
      : level === 0
        ? "Squares"
        : level === 1
          ? "Candidate"
          : level === 2
            ? "Line"
            : "Maxed";

  if (analyzing) {
    return (
      <Alert
        className="shadow-sm"
        data-testid="teaching-card"
        data-state="analyzing"
      >
        <Spinner />
        <AlertTitle>Coach</AlertTitle>
        <AlertDescription>Analyzing your move…</AlertDescription>
      </Alert>
    );
  }

  if (!insight) {
    return (
      <Alert
        className="shadow-sm"
        data-testid="teaching-card"
        data-state="empty"
      >
        <div className="col-span-full flex items-center justify-between gap-2 pr-7">
          <div className="min-w-0">
            <AlertTitle className="mb-0">Coach</AlertTitle>
            <AlertDescription className="text-xs">
              Feedback appears after each move.
            </AlertDescription>
          </div>
          {onRequestHint ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={hintDisabled || level >= 3}
              onClick={onRequestHint}
              data-testid="hint-button"
            >
              {nextHintLabel}
            </Button>
          ) : null}
        </div>
        {hint ? <HintBody hint={hint} /> : null}
        <div
          className="sr-only"
          data-testid="hint-ladder"
          data-hint-level={hint?.level ?? "none"}
          aria-label="Progressive hints"
        />
      </Alert>
    );
  }

  return (
    <Alert
      className="gap-1.5 py-2.5 shadow-sm"
      data-testid="teaching-card"
      data-state="feedback"
      data-classification={insight.classification}
      data-concept={insight.concept}
    >
      <div className="col-span-full flex flex-wrap items-center gap-2 pr-7">
        <AlertTitle className="mb-0">Coach</AlertTitle>
        <Badge
          variant={
            insight.autoExpand
              ? "destructive"
              : insight.classification === "best"
                ? "default"
                : "secondary"
          }
          data-testid="classification-badge"
        >
          {classificationLabel(insight.classification)}
        </Badge>
      </div>
      <AlertDescription
        className="col-span-full text-pretty"
        data-testid="teaching-explanation"
      >
        {insight.explanation}
      </AlertDescription>
      {insight.suggestedMoveSan ? (
        <p className="col-span-full text-sm" data-testid="suggested-move">
          <span className="text-muted-foreground">Try instead: </span>
          <span className="font-medium">{insight.suggestedMoveSan}</span>
        </p>
      ) : null}
      {hint ? <HintBody hint={hint} /> : null}
      <div className="col-span-full flex flex-wrap gap-1.5 pt-0.5">
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
        {onRequestHint ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={hintDisabled || level >= 3}
            onClick={onRequestHint}
            data-testid="hint-button"
          >
            {nextHintLabel}
          </Button>
        ) : null}
      </div>
      <div
        className="sr-only"
        data-testid="hint-ladder"
        data-hint-level={hint?.level ?? "none"}
        aria-label="Progressive hints"
      />
    </Alert>
  );
}

function HintBody({ hint }: { hint: HintStep }) {
  return (
    <div
      className="col-span-full rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm"
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
          Line: {hint.lineUci.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
