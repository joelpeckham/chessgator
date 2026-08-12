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

export type TeachingCardProps = {
  insight: TeachingInsight | null;
  analyzing?: boolean;
  exploringLine?: boolean;
  onExploreLine?: () => void;
  onTakebackRetry: () => void;
  canTakebackRetry: boolean;
};

export function TeachingCard({
  insight,
  analyzing = false,
  exploringLine = false,
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

  return (
    <Card
      size="sm"
      className="border-0 shadow-none ring-1 ring-foreground/5"
      data-testid="teaching-card"
      data-state="feedback"
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
        </div>
        <CardDescription data-testid="teaching-explanation">
          {insight.explanation}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 text-sm">
        {insight.suggestedMoveSan ? (
          <p data-testid="suggested-move">
            <span className="text-muted-foreground">Try instead: </span>
            <span className="font-medium">{insight.suggestedMoveSan}</span>
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
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
          Undo my move
        </Button>
      </CardFooter>
    </Card>
  );
}
