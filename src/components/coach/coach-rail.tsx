"use client";

import { RiArrowUpSLine, RiCloseLine } from "@remixicon/react";
import { useEffect, useRef } from "react";
import { ClassificationBadge } from "@/components/coach/classification-badge";
import { HintLadder } from "@/components/coach/hint-ladder";
import { TeachingCard } from "@/components/coach/teaching-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { HintStep, TeachingInsight } from "@/domain/teaching";
import { cn } from "@/lib/utils";

/** Fixed coach rail height — always reserved so the board never shifts. */
export const COACH_RAIL_PX = 40;

export type CoachRailProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  insight: TeachingInsight | null;
  analyzing: boolean;
  canUndoHumanMove: boolean;
  onUndoHumanMove: () => void;
  onTrySuggested?: () => void;
  onDismiss: () => void;
  hint: HintStep | null;
  hintDisabled?: boolean;
  hintFen?: string | null;
  onRequestHint: () => void;
  showTutorLaneHint?: boolean;
  canExpand?: boolean;
  className?: string;
};

type StripMode = "idle" | "analyzing" | "feedback" | "hints";

function deriveStripMode(args: {
  analyzing: boolean;
  insight: TeachingInsight | null;
  hint: HintStep | null;
}): StripMode {
  if (args.analyzing) return "analyzing";
  if (args.hint && !args.insight) return "hints";
  if (args.insight) return "feedback";
  return "idle";
}

/** Stable callback ref: focus close when the expanded panel mounts. */
function focusCloseOnMount(node: HTMLButtonElement | null): void {
  node?.focus();
}

/**
 * Fixed-height coach strip above the timeline. Expanded details float upward
 * out of document flow so the board never reflows.
 */
export function CoachRail({
  expanded,
  onExpandedChange,
  insight,
  analyzing,
  canUndoHumanMove,
  onUndoHumanMove,
  onTrySuggested,
  onDismiss,
  hint,
  hintDisabled = false,
  hintFen = null,
  onRequestHint,
  showTutorLaneHint = false,
  canExpand = true,
  className,
}: CoachRailProps) {
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  const stripMode = deriveStripMode({
    analyzing,
    insight,
    hint,
  });

  function requestHintAndExpand(): void {
    onRequestHint();
    onExpandedChange(true);
  }

  function collapse(): void {
    onExpandedChange(false);
    expandButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onExpandedChange(false);
        expandButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onExpandedChange]);

  const summary =
    stripMode === "analyzing"
      ? "Analyzing your move…"
      : stripMode === "feedback" && insight
        ? insight.explanation
        : stripMode === "hints" && hint
          ? hint.question
          : "Feedback after your move";

  return (
    <div
      className={cn(
        "coach-rail relative z-20 shrink-0 border-b border-border bg-background",
        className,
      )}
      style={{ height: COACH_RAIL_PX }}
      data-testid="coach-rail"
    >
      <div
        className="flex h-10 min-h-10 max-h-10 items-center gap-2 overflow-hidden px-2 sm:px-3"
        role="region"
        aria-label="Coach feedback"
        data-testid="coach-strip"
        data-mode={stripMode}
        data-hint-level={hint?.level ?? "none"}
        data-expanded={expanded ? "true" : "false"}
      >
        {stripMode === "analyzing" ? (
          <Spinner className="size-3.5 shrink-0" />
        ) : stripMode === "feedback" && insight ? (
          <ClassificationBadge
            insight={insight}
            className="shrink-0"
            testId="classification-badge-strip"
          />
        ) : (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Coach
          </span>
        )}

        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {summary}
        </p>

        <div className="flex shrink-0 items-center gap-1">
          {!expanded && (stripMode === "idle" || stripMode === "hints") ? (
            <HintLadder
              hint={hint}
              fen={hintFen}
              disabled={hintDisabled}
              onRequestHint={requestHintAndExpand}
              compact
            />
          ) : null}

          {canExpand && stripMode !== "idle" && stripMode !== "analyzing" ? (
            <Button
              ref={expandButtonRef}
              type="button"
              size="icon-xs"
              variant="ghost"
              className="size-8"
              aria-label={
                expanded ? "Hide coach feedback" : "Show coach feedback"
              }
              aria-expanded={expanded}
              aria-controls="coach-expanded-panel"
              data-testid="coach-expand"
              onClick={() => {
                if (expanded) {
                  collapse();
                } else {
                  onExpandedChange(true);
                }
              }}
            >
              <RiArrowUpSLine
                className={cn("transition-transform", expanded && "rotate-180")}
              />
            </Button>
          ) : null}

          {stripMode === "feedback" ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="size-8"
              aria-label="Dismiss coach feedback"
              data-testid="dismiss-teaching-card"
              onClick={() => {
                onDismiss();
                collapse();
              }}
            >
              <RiCloseLine />
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div
          id="coach-expanded-panel"
          className="coach-expanded-panel"
          data-testid="coach-expanded-panel"
        >
          <div className="relative px-3 py-3 sm:px-4">
            <Button
              ref={focusCloseOnMount}
              type="button"
              size="icon-xs"
              variant="ghost"
              className="absolute top-2 right-2 z-10"
              aria-label="Collapse coach feedback"
              data-testid="collapse-teaching-card"
              onClick={collapse}
            >
              <RiCloseLine />
            </Button>
            <TeachingCard
              insight={insight}
              analyzing={analyzing}
              canUndoHumanMove={canUndoHumanMove}
              onUndoHumanMove={onUndoHumanMove}
              onTrySuggested={onTrySuggested}
              hint={hint}
              hintDisabled={hintDisabled}
              hintFen={hintFen}
              showTutorLaneHint={showTutorLaneHint}
              onRequestHint={requestHintAndExpand}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
