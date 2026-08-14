"use client";

import { RiCloseLine } from "@remixicon/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CoachBalloon } from "@/components/coach/coach-balloon";
import {
  type GatorMood,
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";
import {
  CLAWS_DISPLAY,
  CLAWS_SRC,
  GATOR_LEDGE_OVERLAP_PX,
  gatorDisplaySize,
} from "@/components/coach/gator-layout";
import { TeachingCard } from "@/components/coach/teaching-card";
import {
  IDLE_HINT_QUIP,
  scheduleIdleHint,
  scheduleTeaserExpiry,
} from "@/components/coach/teaser-timing";
import { Button } from "@/components/ui/button";
import {
  classificationLabel,
  type HintStep,
  type TeachingInsight,
} from "@/domain/teaching";
import { cn } from "@/lib/utils";

export type CoachMascotProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  insight: TeachingInsight | null;
  analyzing: boolean;
  onTrySuggested?: () => void;
  onDismiss: () => void;
  hint: HintStep | null;
  hintDisabled?: boolean;
  hintFen?: string | null;
  onRequestHint: () => void;
  showTutorLaneHint?: boolean;
  idleHintEligible?: boolean;
};

type MascotMode = "idle" | "analyzing" | "feedback" | "hints";

type TeaserKind = "praise" | "nudge" | "idle";

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
 * Coach mascot tucked behind the timeline ledge. Face always reacts;
 * the lesson balloon never auto-opens.
 */
export function CoachMascot({
  expanded,
  onExpandedChange,
  insight,
  analyzing,
  onTrySuggested,
  onDismiss,
  hint,
  hintDisabled = false,
  hintFen = null,
  onRequestHint,
  showTutorLaneHint = false,
  idleHintEligible = false,
}: CoachMascotProps) {
  const gatorButtonRef = useRef<HTMLButtonElement>(null);
  const [idlePromptVisible, setIdlePromptVisible] = useState(false);
  const [expiredTeaserKey, setExpiredTeaserKey] = useState<string | null>(null);
  if (!idleHintEligible && idlePromptVisible) {
    setIdlePromptVisible(false);
  }

  const mode = deriveMode({ analyzing, insight, hint });
  const expression = gatorExpressionFor(deriveMood({ mode, insight }));
  const showNudgeTeaser = Boolean(insight?.nudge) && mode === "feedback";
  const showPraiseTeaser =
    insight?.classification === "best" ||
    insight?.classification === "excellent";
  const showIdleTeaser = idlePromptVisible && idleHintEligible;

  const teaserKind: TeaserKind | null = showNudgeTeaser
    ? "nudge"
    : showPraiseTeaser
      ? "praise"
      : showIdleTeaser
        ? "idle"
        : null;
  const teaserText =
    teaserKind === "idle" ? IDLE_HINT_QUIP : (insight?.quip ?? null);
  const teaserKey =
    teaserKind === "idle"
      ? "idle"
      : teaserKind && teaserText
        ? `${teaserKind}:${insight?.classification ?? ""}:${insight?.explanation ?? ""}:${teaserText}`
        : null;
  const teaserVisible =
    !expanded &&
    Boolean(teaserKind && teaserText && expiredTeaserKey !== teaserKey);

  useEffect(() => {
    if (!idleHintEligible) return;
    return scheduleIdleHint(true, () => setIdlePromptVisible(true));
  }, [idleHintEligible]);

  useEffect(() => {
    if (!teaserKey || expiredTeaserKey === teaserKey) return;
    return scheduleTeaserExpiry(teaserKey, () =>
      setExpiredTeaserKey(teaserKey),
    );
  }, [teaserKey, expiredTeaserKey]);

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
    if ((mode === "idle" || mode === "hints") && !hint && !hintDisabled) {
      requestHintAndExpand();
      return;
    }
    onExpandedChange(true);
  }

  const nudgeMotion =
    insight?.classification === "blunder"
      ? "coach-mascot-pulse"
      : insight?.classification === "mistake"
        ? "coach-mascot-nudge"
        : undefined;

  const head = gatorDisplaySize(expression);

  return (
    <div
      className="absolute left-2 z-30"
      style={{ bottom: `calc(100% - ${GATOR_LEDGE_OVERLAP_PX}px)` }}
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

      {teaserVisible && teaserKind && teaserText ? (
        <div
          className="coach-teaser pointer-events-auto"
          data-testid="coach-teaser"
          data-kind={teaserKind}
          aria-hidden={teaserKind === "praise" ? true : undefined}
        >
          <p className="text-xs font-medium text-pretty">{teaserText}</p>
          {teaserKind === "nudge" ? (
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

      <div className="pointer-events-auto">
        <button
          ref={gatorButtonRef}
          type="button"
          className={cn(
            "block p-0 leading-none rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-foreground",
            analyzing && "cursor-default opacity-90",
            insight?.nudge && !expanded && teaserVisible && nudgeMotion,
          )}
          aria-label={mascotAriaLabel({ expanded, mode, insight })}
          aria-expanded={expanded}
          aria-controls="coach-balloon"
          data-testid="coach-gator"
          disabled={analyzing}
          onClick={toggle}
        >
          <span
            className="relative block"
            style={{ width: head.width, height: head.height }}
          >
            <Image
              src={gatorSrc(expression)}
              alt=""
              width={Math.round(head.width)}
              height={Math.round(head.height)}
              className="block h-full w-full select-none"
              draggable={false}
              loading="eager"
            />
            <Image
              src={CLAWS_SRC}
              alt=""
              width={Math.round(CLAWS_DISPLAY.width)}
              height={Math.round(CLAWS_DISPLAY.height)}
              className="pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2 select-none"
              style={{
                top: head.height - CLAWS_DISPLAY.cutoutFromTop,
                width: CLAWS_DISPLAY.width,
                height: CLAWS_DISPLAY.height,
              }}
              draggable={false}
              loading="eager"
            />
          </span>
        </button>
      </div>
    </div>
  );
}
