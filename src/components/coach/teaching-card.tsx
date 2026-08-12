"use client";

import type { TeachingInsight } from "@/domain/teaching";
import { classificationLabel } from "@/domain/teaching";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TeachingCardProps = {
  insight: TeachingInsight | null;
  expanded: boolean;
  showLine: boolean;
  analyzing?: boolean;
  exploringLine?: boolean;
  onToggleExpanded: () => void;
  onShowLine: () => void;
  onExploreLine?: () => void;
  onTakebackRetry: () => void;
  canTakebackRetry: boolean;
};

export function TeachingCard({
  insight,
  expanded,
  showLine,
  analyzing = false,
  exploringLine = false,
  onToggleExpanded,
  onShowLine,
  onExploreLine,
  onTakebackRetry,
  canTakebackRetry,
}: TeachingCardProps) {
  if (analyzing) {
    return (
      <Card
        size="sm"
        className="border-0 shadow-none ring-1 ring-foreground/5"
        data-testid="teaching-card"
        data-state="analyzing"
      >
        <CardHeader>
          <CardTitle>Coach</CardTitle>
          <CardDescription>Analyzing your move…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!insight) {
    return (
      <Card
        size="sm"
        className="border-0 shadow-none ring-1 ring-foreground/5"
        data-testid="teaching-card"
        data-state="empty"
      >
        <CardHeader>
          <CardTitle>Coach</CardTitle>
          <CardDescription>
            Feedback appears after each of your moves. Ask for a hint before
            you move.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const compact = !expanded;

  return (
    <Card
      size="sm"
      className="border-0 shadow-none ring-1 ring-foreground/5"
      data-testid="teaching-card"
      data-state={expanded ? "expanded" : "compact"}
      data-classification={insight.classification}
      data-concept={insight.concept}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-heading">Coach</CardTitle>
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
          <Badge variant="outline" data-testid="concept-badge">
            {conceptLabel(insight.concept)}
          </Badge>
        </div>
        <CardDescription
          className={cn(compact && "line-clamp-2")}
          data-testid="teaching-explanation"
        >
          {insight.explanation}
        </CardDescription>
      </CardHeader>

      {!compact ? (
        <CardContent className="flex flex-col gap-2 text-sm">
          {insight.suggestedMoveSan ? (
            <p data-testid="suggested-move">
              <span className="text-muted-foreground">Try instead: </span>
              <span className="font-medium">{insight.suggestedMoveSan}</span>
            </p>
          ) : null}
          {insight.maiaPredictedLikelihood !== undefined ? (
            <p data-testid="maia-likelihood" className="text-muted-foreground">
              Model-predicted likelihood:{" "}
              {Math.round(insight.maiaPredictedLikelihood * 100)}%
            </p>
          ) : null}
        </CardContent>
      ) : null}

      {showLine && insight.lineUci.length > 0 ? (
        <CardContent className="pt-0">
          <p className="font-mono text-xs" data-testid="shown-line">
            Better: {insight.lineUci.join(" ")}
          </p>
          {insight.refutationUci.length > 0 ? (
            <p
              className="mt-1 font-mono text-xs text-muted-foreground"
              data-testid="shown-refutation"
            >
              If played: {insight.refutationUci.join(" ")}
            </p>
          ) : null}
        </CardContent>
      ) : null}

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onToggleExpanded}
          data-testid="toggle-teaching-card"
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onShowLine}
          aria-pressed={showLine}
          data-testid="show-line-button"
          disabled={analyzing}
        >
          {showLine ? "Hide line" : "Show line"}
        </Button>
        {onExploreLine && insight.lineUci.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onExploreLine}
            aria-pressed={exploringLine}
            data-testid="explore-line-button"
            disabled={analyzing || exploringLine}
          >
            {exploringLine ? "Exploring…" : "Explore better line"}
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
          Take back and retry
        </Button>
      </CardFooter>
    </Card>
  );
}

function conceptLabel(concept: TeachingInsight["concept"]): string {
  switch (concept) {
    case "piece_safety":
      return "Piece safety";
    case "king_safety":
      return "King safety";
    case "missed_improvement":
      return "Improvement";
    case "solid_move":
      return "Solid";
    case "best_move":
      return "Best move";
    default:
      return concept.replaceAll("_", " ");
  }
}
