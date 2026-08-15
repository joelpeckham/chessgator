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
  COACH_COLUMN_WIDTH_PX,
  clawsLayerStyle,
  GATOR_CLAWS,
  GATOR_LEDGE_INSET_PX,
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
  showSuggestedMoveHint?: boolean;
  idleHintEligible?: boolean;
  docked?: boolean;
  laneLeft?: number;
  orientationTeaser?: string | null;
  mood?: GatorMood | null;
};

type MascotMode = "idle" | "analyzing" | "feedback" | "hints";

type TeaserKind = "praise" | "nudge" | "idle";

type CoachTeaser = {
  kind: TeaserKind;
  text: string;
  key: string;
};

function deriveTeaser(args: {
  insight: TeachingInsight | null;
  mode: MascotMode;
  orientationTeaser: string | null;
  docked: boolean;
  idlePromptVisible: boolean;
  idleHintEligible: boolean;
}): CoachTeaser | null {
  const quip = args.insight?.quip ?? null;
  if (args.insight?.nudge && args.mode === "feedback" && quip) {
    return {
      kind: "nudge",
      text: quip,
      key: `nudge:${args.insight.classification}:${args.insight.explanation}:${quip}`,
    };
  }
  if (
    (args.insight?.classification === "best" ||
      args.insight?.classification === "excellent") &&
    quip
  ) {
    return {
      kind: "praise",
      text: quip,
      key: `praise:${args.insight.classification}:${args.insight.explanation}:${quip}`,
    };
  }
  if (args.orientationTeaser && !args.docked) {
    return {
      kind: "idle",
      text: args.orientationTeaser,
      key: "orientation",
    };
  }
  if (args.idlePromptVisible && args.idleHintEligible) {
    return { kind: "idle", text: IDLE_HINT_QUIP, key: "idle" };
  }
  return null;
}

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
  mood?: GatorMood | null;
}): GatorMood {
  if (args.mood) return args.mood;
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
 * the lesson balloon never auto-opens except in the wide docked lane.
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
  showSuggestedMoveHint = false,
  idleHintEligible = false,
  docked = false,
  laneLeft = 0,
  orientationTeaser = null,
  mood = null,
}: CoachMascotProps) {
  const gatorButtonRef = useRef<HTMLButtonElement>(null);
  const [idlePromptVisible, setIdlePromptVisible] = useState(false);
  const [expiredTeaserKey, setExpiredTeaserKey] = useState<string | null>(null);
  if (!idleHintEligible && idlePromptVisible) {
    setIdlePromptVisible(false);
  }

  const mode = deriveMode({ analyzing, insight, hint });
  const expression = gatorExpressionFor(deriveMood({ mode, insight, mood }));
  const teaser = deriveTeaser({
    insight,
    mode,
    orientationTeaser,
    docked,
    idlePromptVisible,
    idleHintEligible,
  });
  const teaserKey = teaser?.key ?? null;
  const showOrientationTeaser = teaserKey === "orientation";
  const shownTeaser =
    !expanded &&
    teaser &&
    (showOrientationTeaser || expiredTeaserKey !== teaserKey)
      ? teaser
      : null;

  useEffect(() => {
    if (!idleHintEligible) return;
    return scheduleIdleHint(true, () => setIdlePromptVisible(true));
  }, [idleHintEligible]);

  useEffect(() => {
    if (
      !teaserKey ||
      teaserKey === "orientation" ||
      expiredTeaserKey === teaserKey
    )
      return;
    return scheduleTeaserExpiry(teaserKey, () =>
      setExpiredTeaserKey(teaserKey),
    );
  }, [teaserKey, expiredTeaserKey]);

  useEffect(() => {
    if (!expanded || docked) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onExpandedChange(false);
        gatorButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docked, expanded, onExpandedChange]);

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
    if (docked) {
      if ((mode === "idle" || mode === "hints") && !hint && !hintDisabled) {
        onRequestHint();
      }
      return;
    }
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
  const claws = clawsLayerStyle(expression, head.height);
  const teachingCard = (
    <TeachingCard
      insight={insight}
      analyzing={analyzing}
      onTrySuggested={onTrySuggested}
      hint={hint}
      hintDisabled={hintDisabled}
      hintFen={hintFen}
      showSuggestedMoveHint={showSuggestedMoveHint}
      onRequestHint={requestHintAndExpand}
      emptyCopy={orientationTeaser}
    />
  );

  return (
    <div
      className="absolute"
      style={{
        left: (docked ? laneLeft : 0) + GATOR_LEDGE_INSET_PX,
        bottom: `calc(100% - ${GATOR_LEDGE_OVERLAP_PX}px)`,
      }}
      data-testid="coach-mascot"
      data-mode={mode}
      data-expression={expression}
      data-hands={GATOR_CLAWS[expression].hands}
      data-expanded={expanded ? "true" : "false"}
      data-docked={docked ? "true" : "false"}
      data-hint-level={hint?.level ?? "none"}
      role="region"
      aria-label="Coach feedback"
    >
      {!docked && expanded ? (
        <div className="pointer-events-auto">
          <CoachBalloon onCollapse={collapse}>{teachingCard}</CoachBalloon>
        </div>
      ) : null}

      {shownTeaser ? (
        <div
          className="coach-teaser pointer-events-auto"
          data-testid="coach-teaser"
          data-kind={shownTeaser.kind}
          aria-hidden={shownTeaser.kind === "praise" ? true : undefined}
        >
          <p className="text-xs font-medium text-pretty">{shownTeaser.text}</p>
          {shownTeaser.kind === "nudge" ? (
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

      <div className="pointer-events-auto relative">
        <button
          ref={gatorButtonRef}
          type="button"
          className={cn(
            "block p-0 leading-none rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-foreground",
            analyzing && "cursor-default opacity-90",
            insight?.nudge && !expanded && shownTeaser && nudgeMotion,
          )}
          aria-label={mascotAriaLabel({ expanded, mode, insight })}
          aria-expanded={expanded}
          aria-controls={docked ? "coach-panel" : "coach-balloon"}
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
          </span>
        </button>
        <Image
          src={CLAWS_SRC}
          alt=""
          width={Math.round(CLAWS_DISPLAY.width)}
          height={Math.round(CLAWS_DISPLAY.height)}
          className="pointer-events-none absolute left-1/2 z-20 max-w-none select-none"
          style={{
            ...claws,
            top: claws.top - GATOR_LEDGE_OVERLAP_PX,
          }}
          draggable={false}
          loading="eager"
        />
      </div>
      {docked ? (
        <div
          id="coach-panel"
          className="coach-panel-docked"
          style={{
            left: 12 - GATOR_LEDGE_INSET_PX,
            width: COACH_COLUMN_WIDTH_PX - 24,
          }}
          data-testid="coach-panel"
        >
          {teachingCard}
        </div>
      ) : null}
    </div>
  );
}
