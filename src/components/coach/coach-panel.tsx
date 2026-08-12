"use client";

import type { HintStep, TeachingInsight } from "@/domain/teaching";
import { HintLadder } from "@/components/coach/hint-ladder";
import { TeachingCard } from "@/components/coach/teaching-card";

export type CoachPanelProps = {
  insight: TeachingInsight | null;
  hint: HintStep | null;
  expanded: boolean;
  showLine: boolean;
  analyzing: boolean;
  exploringLine?: boolean;
  hintsDisabled: boolean;
  canTakebackRetry: boolean;
  onToggleExpanded: () => void;
  onShowLine: () => void;
  onExploreLine?: () => void;
  onTakebackRetry: () => void;
  onRequestHint: () => void;
};

export function CoachPanel({
  insight,
  hint,
  expanded,
  showLine,
  analyzing,
  exploringLine = false,
  hintsDisabled,
  canTakebackRetry,
  onToggleExpanded,
  onShowLine,
  onExploreLine,
  onTakebackRetry,
  onRequestHint,
}: CoachPanelProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="coach-panel">
      <TeachingCard
        insight={insight}
        expanded={expanded}
        showLine={showLine}
        analyzing={analyzing}
        exploringLine={exploringLine}
        onToggleExpanded={onToggleExpanded}
        onShowLine={onShowLine}
        onExploreLine={onExploreLine}
        onTakebackRetry={onTakebackRetry}
        canTakebackRetry={canTakebackRetry}
      />
      <HintLadder
        hint={hint}
        disabled={hintsDisabled}
        onRequestHint={onRequestHint}
      />
    </div>
  );
}
