"use client";

import { RiCloseLine } from "@remixicon/react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { CoachBalloon } from "@/components/coach/coach-balloon";
import {
  type GatorMood,
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";
import { HintLadder } from "@/components/coach/hint-ladder";
import { TeachingCard } from "@/components/coach/teaching-card";
import { Button } from "@/components/ui/button";
import {
  classificationLabel,
  type HintStep,
  type TeachingInsight,
} from "@/domain/teaching";
import { cn } from "@/lib/utils";

/** Reserved left column: gator + gap before the board. */
export const MASCOT_DOCK_WIDTH_PX = 120;
/** Reserved bottom strip when the board snaps above the mascot. */
export const MASCOT_DOCK_HEIGHT_PX = 96;

export type CoachMascotProps = {
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
  compact?: boolean;
};

type MascotMode = "idle" | "analyzing" | "feedback" | "hints";

function deriveMode(args: {
  analyzing: boolean;
  insight: TeachingInsight | null;
  hint: HintStep | null;
}): MascotMode {
  if (args.analyzing) return "analyzing";
  if (args.hint && !args.insight) return "hints";
  if (args.insight) return "feedback";
  return "idle";
}

function deriveMood(args: {
  mode: MascotMode;
  insight: TeachingInsight | null;
}): GatorMood {
  if (args.mode === "analyzing") return "analyzing";
  if (args.mode === "hints") return "hint";
  if (args.insight) return args.insight.classification;
  return "idle";
}

function mascotAriaLabel(args: {
  expanded: boolean;
  mode: MascotMode;
  insight: TeachingInsight | null;
}): string {
  if (args.expanded) return "Hide coach feedback";
  if (args.mode === "analyzing") return "Coach is analyzing";
  if (args.insight?.classification === "blunder") {
    return "Coach: blunder — show why";
  }
  if (args.insight?.classification === "mistake") {
    return "Coach: mistake — show why";
  }
  if (args.insight) {
    return `Coach: ${classificationLabel(args.insight.classification)} — show details`;
  }
  return "Coach: get a hint";
}

/**
 * Clippy-style coach mascot in leftover main space. Face always reacts;
 * the lesson balloon never auto-opens.
 */
export function CoachMascot({
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
  compact = false,
}: CoachMascotProps) {
  const gatorButtonRef = useRef<HTMLButtonElement>(null);

  const mode = deriveMode({ analyzing, insight, hint });
  const expression = gatorExpressionFor(deriveMood({ mode, insight }));
  const showNudgeTeaser =
    !expanded && Boolean(insight?.nudge) && mode === "feedback";
  const showPraiseTeaser =
    !expanded &&
    (insight?.classification === "best" ||
      insight?.classification === "excellent");

  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onExpandedChange(false);
        gatorButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onExpandedChange]);

  function requestHintAndExpand(): void {
    onRequestHint();
    onExpandedChange(true);
  }

  function collapse(): void {
    onExpandedChange(false);
    gatorButtonRef.current?.focus();
  }

  function toggle(): void {
    if (analyzing) return;
    if (expanded) {
      collapse();
      return;
    }
    onExpandedChange(true);
  }

  const teaserText = insight?.quip ?? null;
  const nudgeMotion =
    insight?.classification === "blunder"
      ? "coach-mascot-pulse"
      : insight?.classification === "mistake"
        ? "coach-mascot-nudge"
        : undefined;

  return (
    <div
      className="relative z-20"
      data-testid="coach-mascot"
      data-mode={mode}
      data-expression={expression}
      data-expanded={expanded ? "true" : "false"}
      data-hint-level={hint?.level ?? "none"}
      role="region"
      aria-label="Coach feedback"
    >
      {expanded ? (
        <div className="pointer-events-auto">
          <CoachBalloon onCollapse={collapse}>
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
          </CoachBalloon>
        </div>
      ) : null}

      {(showNudgeTeaser || showPraiseTeaser) && teaserText ? (
        <div
          className="coach-teaser pointer-events-auto"
          data-testid="coach-teaser"
          data-kind={showNudgeTeaser ? "nudge" : "praise"}
          aria-hidden={showPraiseTeaser && !showNudgeTeaser ? true : undefined}
        >
          <p className="min-w-0 flex-1 text-xs font-medium">{teaserText}</p>
          {showNudgeTeaser ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="size-6 shrink-0"
              aria-label="Dismiss coach feedback"
              data-testid="dismiss-teaching-card"
              onClick={onDismiss}
            >
              <RiCloseLine />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-auto flex gap-1.5",
          compact ? "flex-row items-end" : "flex-col-reverse items-center",
        )}
      >
        <button
          ref={gatorButtonRef}
          type="button"
          className={cn(
            "rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-foreground",
            analyzing && "cursor-default opacity-90",
            insight?.nudge && !expanded && nudgeMotion,
          )}
          aria-label={mascotAriaLabel({ expanded, mode, insight })}
          aria-expanded={expanded}
          aria-controls="coach-balloon"
          data-testid="coach-gator"
          disabled={analyzing}
          onClick={toggle}
        >
          <Image
            src={gatorSrc(expression)}
            alt=""
            width={246}
            height={409}
            className={cn(
              "w-auto select-none object-contain",
              compact ? "h-[72px]" : "h-[100px]",
            )}
            draggable={false}
            loading="eager"
          />
        </button>

        {!expanded && (mode === "idle" || mode === "hints") ? (
          <HintLadder
            hint={hint}
            fen={hintFen}
            disabled={hintDisabled}
            onRequestHint={requestHintAndExpand}
            compact
          />
        ) : null}
      </div>
    </div>
  );
}
