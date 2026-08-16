"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { computeBalloonLayout } from "@/components/coach/balloon-layout";
import { CoachBalloon } from "@/components/coach/coach-balloon";
import {
  type GatorMood,
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";
import {
  CLAWS_DISPLAY,
  CLAWS_SRC,
  clawsLayerStyle,
  GATOR_CLAWS,
  GATOR_LEDGE_OVERLAP_PX,
  gatorDisplaySize,
} from "@/components/coach/gator-layout";
import { TeachingCard } from "@/components/coach/teaching-card";
import {
  IDLE_HINT_QUIP,
  scheduleIdleHint,
  scheduleTeaserExpiry,
} from "@/components/coach/teaser-timing";
import {
  classificationLabel,
  type HintStep,
  type TeachingInsight,
} from "@/domain/teaching";
import { bouncySpring, popSpring } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

/**
 * The gator art is cut flat at the neck. Hover lift and nudge bounces can
 * raise that edge above the timeline ledge, so a mirrored sliver of the
 * same image extends the neck just enough to keep the edge hidden.
 */
const NECK_BLEED_PX = 12;

/**
 * Head motion states: a slow breathing loop when idle, a thinking sway
 * while analyzing, bounce + worry pulse for blunders.
 */
const HEAD_VARIANTS: Variants = {
  idle: {
    y: 0,
    rotate: 0,
    opacity: 1,
    scale: [1, 1.025, 1],
    transition: {
      scale: { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
    },
  },
  analyzing: {
    y: 0,
    opacity: 1,
    scale: 1,
    rotate: [-1.8, 1.8],
    transition: {
      rotate: {
        duration: 1.1,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      },
    },
  },
  alarmed: {
    rotate: 0,
    scale: 1,
    y: [0, -7, -2, 0],
    opacity: [1, 0.72, 1],
    transition: {
      y: { duration: 0.6, ease: "easeOut" },
      opacity: {
        duration: 1.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.6,
      },
    },
  },
};

export type CoachMascotProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  insight: TeachingInsight | null;
  analyzing: boolean;
  onTrySuggested?: () => void;
  hint: HintStep | null;
  hintDisabled?: boolean;
  hintFen?: string | null;
  onRequestHint: () => void;
  showSuggestedMoveHint?: boolean;
  idleHintEligible?: boolean;
  /** Viewport x of the gator's left edge; hugs the board's left side. */
  left?: number;
  orientationTeaser?: string | null;
  mood?: GatorMood | null;
};

type MascotMode = "idle" | "analyzing" | "feedback" | "hints";

type CoachTeaser = {
  text: string;
  key: string;
};

/** Tutorial-only teasers: orientation copy and the idle hint prompt. */
function deriveTeaser(args: {
  orientationTeaser: string | null;
  idlePromptVisible: boolean;
  idleHintEligible: boolean;
}): CoachTeaser | null {
  if (args.orientationTeaser) {
    return {
      text: args.orientationTeaser,
      key: "orientation",
    };
  }
  if (args.idlePromptVisible && args.idleHintEligible) {
    return { text: IDLE_HINT_QUIP, key: "idle" };
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
 * Coach mascot tucked behind the timeline ledge, floating at the board's
 * left edge. Face always reacts; the advice only auto-opens on blunders.
 */
export function CoachMascot({
  expanded,
  onExpandedChange,
  insight,
  analyzing,
  onTrySuggested,
  hint,
  hintDisabled = false,
  hintFen = null,
  onRequestHint,
  showSuggestedMoveHint = false,
  idleHintEligible = false,
  left = 0,
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
    orientationTeaser,
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

  const headState =
    mode === "analyzing"
      ? "analyzing"
      : mode === "feedback" &&
          !expanded &&
          insight?.classification === "blunder"
        ? "alarmed"
        : "idle";

  const head = gatorDisplaySize(expression);
  const claws = clawsLayerStyle(expression, head.height);
  const balloon = computeBalloonLayout({
    mascotLeft: left,
    headWidth: head.width,
    viewportWidth: typeof window === "undefined" ? 1280 : window.innerWidth,
  });
  const preferLeftMargin = balloon.anchor === "margin";
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
        left,
        bottom: `calc(100% - ${GATOR_LEDGE_OVERLAP_PX}px)`,
        ["--coach-balloon-left" as string]: `${balloon.left}px`,
        ["--coach-balloon-max" as string]: `${balloon.maxWidth}px`,
        ["--coach-tail-inset" as string]: `${balloon.tailInset}px`,
      }}
      data-testid="coach-mascot"
      data-mode={mode}
      data-expression={expression}
      data-hands={GATOR_CLAWS[expression].hands}
      data-expanded={expanded ? "true" : "false"}
      data-balloon-anchor={balloon.anchor}
      data-hint-level={hint?.level ?? "none"}
      role="region"
      aria-label="Coach feedback"
    >
      <AnimatePresence>
        {expanded ? (
          <div className="pointer-events-auto" key="coach-balloon">
            <CoachBalloon
              onCollapse={collapse}
              originX={preferLeftMargin ? 1 : 0}
            >
              {teachingCard}
            </CoachBalloon>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {shownTeaser ? (
          <motion.div
            key={shownTeaser.key}
            className="coach-teaser"
            data-testid="coach-teaser"
            style={{ originX: preferLeftMargin ? 1 : 0, originY: 1 }}
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.92,
              y: 4,
              transition: { duration: 0.18, ease: "easeIn" },
            }}
            transition={popSpring}
          >
            <p className="text-xs font-medium text-pretty">
              {shownTeaser.text}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-auto relative">
        <motion.button
          ref={gatorButtonRef}
          type="button"
          className={cn(
            "block p-0 leading-none rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-foreground",
            analyzing && "cursor-default opacity-90",
          )}
          aria-label={mascotAriaLabel({ expanded, mode, insight })}
          aria-expanded={expanded}
          aria-controls="coach-balloon"
          data-testid="coach-gator"
          disabled={analyzing}
          onClick={toggle}
          whileHover={{ y: -5, rotate: -2, scale: 1.04 }}
          whileTap={{ y: 1, scaleX: 1.06, scaleY: 0.92 }}
          transition={bouncySpring}
        >
          <motion.span
            className="relative block"
            style={{ width: head.width, height: head.height }}
            variants={HEAD_VARIANTS}
            animate={headState}
            data-head-state={headState}
          >
            <motion.span
              key={expression}
              className="relative block h-full w-full"
              initial={{ scale: 0.82, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={popSpring}
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
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-full block overflow-hidden"
                style={{ height: NECK_BLEED_PX }}
              >
                <Image
                  src={gatorSrc(expression)}
                  alt=""
                  width={Math.round(head.width)}
                  height={Math.round(head.height)}
                  className="block w-full -scale-y-100 select-none"
                  style={{ height: head.height }}
                  draggable={false}
                  loading="eager"
                />
              </span>
            </motion.span>
          </motion.span>
        </motion.button>
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
    </div>
  );
}
