"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { computeBalloonLayout } from "@/components/coach/balloon-layout";
import { CoachBalloon } from "@/components/coach/coach-balloon";
import {
  type GatorExpression,
  type GatorMood,
  gatorSrc,
  resolveCoachExpression,
} from "@/components/coach/gator-expression";
import {
  CLAWS_DISPLAY,
  CLAWS_SRC,
  clawsLayerStyle,
  GATOR_CLAWS,
  GATOR_LEDGE_OVERLAP_PX,
  gatorDisplaySize,
  neckMirrorStyle,
} from "@/components/coach/gator-layout";
import { TeachingCard } from "@/components/coach/teaching-card";
import {
  HINT_PENDING_QUIP,
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
  /** Hint is loading; keep the balloon closed until content is ready. */
  hintPending?: boolean;
  onTrySuggested?: () => void;
  hint: HintStep | null;
  hintDisabled?: boolean;
  hintFen?: string | null;
  onRequestHint: () => void;
  onClearHint?: () => void;
  idleHintEligible?: boolean;
  /** Viewport x of the gator's left edge; hugs the board's left side. */
  left?: number;
  orientationTeaser?: string | null;
  emptyCopy?: string | null;
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
  waitingForHint: boolean;
}): CoachTeaser | null {
  if (args.waitingForHint) {
    return { text: HINT_PENDING_QUIP, key: "hint-pending" };
  }
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
  if (args.hint) return "hints";
  if (args.insight) return "feedback";
  return "idle";
}

function deriveMood(args: {
  insight: TeachingInsight | null;
  mood?: GatorMood | null;
}): GatorMood {
  if (args.mood) return args.mood;
  if (args.insight) return args.insight.classification;
  return "idle";
}

function mascotAriaLabel(args: {
  expanded: boolean;
  mode: MascotMode;
  insight: TeachingInsight | null;
  waitingForHint: boolean;
}): string {
  if (args.expanded) return "Hide coach feedback";
  if (args.waitingForHint) return "Coach is thinking of a hint";
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
  hintPending = false,
  onTrySuggested,
  hint,
  hintDisabled = false,
  hintFen = null,
  onRequestHint,
  onClearHint,
  idleHintEligible = false,
  left = 0,
  orientationTeaser = null,
  emptyCopy = null,
  mood = null,
}: CoachMascotProps) {
  const gatorButtonRef = useRef<HTMLButtonElement>(null);
  const [idlePromptVisible, setIdlePromptVisible] = useState(false);
  const [expiredTeaserKey, setExpiredTeaserKey] = useState<string | null>(null);
  const [heldExpression, setHeldExpression] =
    useState<GatorExpression>("neutral-happy");
  if (!idleHintEligible && idlePromptVisible) {
    setIdlePromptVisible(false);
  }

  const waitingForHint = hintPending && !expanded;
  const mode = deriveMode({ analyzing, insight, hint });
  const expression = resolveCoachExpression({
    mood: deriveMood({ insight, mood }),
    analyzing,
    held: heldExpression,
  });
  if (heldExpression !== expression) {
    setHeldExpression(expression);
  }
  const teaser = deriveTeaser({
    orientationTeaser,
    idlePromptVisible,
    idleHintEligible,
    waitingForHint,
  });
  const teaserKey = teaser?.key ?? null;
  const keepTeaser =
    teaserKey === "orientation" || teaserKey === "hint-pending";
  const shownTeaser =
    !expanded && teaser && (keepTeaser || expiredTeaserKey !== teaserKey)
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
      teaserKey === "hint-pending" ||
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

  function collapse(): void {
    onExpandedChange(false);
    gatorButtonRef.current?.focus();
  }

  function toggle(): void {
    if (analyzing || waitingForHint) return;
    if (expanded) {
      collapse();
      return;
    }
    if (insight) {
      onClearHint?.();
      onExpandedChange(true);
      return;
    }
    if (!hint && !hintDisabled) {
      onRequestHint();
      return;
    }
    onExpandedChange(true);
  }

  const headState =
    mode === "analyzing" || waitingForHint
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
      onRequestHint={onRequestHint}
      emptyCopy={emptyCopy}
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
      data-hint-pending={hintPending ? "true" : "false"}
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
            (analyzing || waitingForHint) && "cursor-default opacity-90",
          )}
          aria-label={mascotAriaLabel({
            expanded,
            mode,
            insight,
            waitingForHint,
          })}
          aria-expanded={expanded}
          aria-controls="coach-balloon"
          data-testid="coach-gator"
          disabled={analyzing || waitingForHint}
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
                className="pointer-events-none absolute inset-x-0 block overflow-hidden"
                style={neckMirrorStyle()}
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
