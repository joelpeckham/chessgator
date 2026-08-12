"use client";

import { Badge } from "@/components/ui/badge";
import type { TeachingInsight } from "@/domain/teaching";
import { classificationLabel } from "@/domain/teaching";

export function ClassificationBadge({
  insight,
  testId,
  className,
}: {
  insight: TeachingInsight;
  testId?: string;
  className?: string;
}) {
  const variant = insight.nudge
    ? "destructive"
    : insight.classification === "best"
      ? "default"
      : "secondary";
  return (
    <Badge variant={variant} className={className} data-testid={testId}>
      {classificationLabel(insight.classification)}
    </Badge>
  );
}
