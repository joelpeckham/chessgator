"use client";

import { motion, type Variants } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import {
  type GatorExpression,
  resolveCoachExpression,
} from "@/components/coach/gator-expression";
import { GATOR_LEDGE_OVERLAP_PX } from "@/components/coach/gator-layout";
import { GatorPeek } from "@/components/coach/gator-peek";
import { TeachingCard } from "@/components/coach/teaching-card";
import { HERO_GATOR_SCALE, HeroFrame } from "@/components/landing/hero-frame";
import { Button, buttonVariants } from "@/components/ui/button";
import { useHeroDemo } from "@/features/landing/use-hero-demo";
import { bouncySpring } from "@/lib/motion-presets";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";

/** Ms without pointer/keyboard activity before the gator dozes off. */
const IDLE_DOZE_MS = 30_000;
/** Throttle for resetting the doze timer on pointermove. */
const DOZE_RESET_THROTTLE_MS = 1_000;

/**
 * Head motion: breathing when idle, sway while the coach analyzes, a happy
 * perk when the visitor eyes the CTA, and a slow slump when dozing.
 */
const HEAD_VARIANTS: Variants = {
  idle: {
    y: 0,
    rotate: 0,
    scale: [1, 1.02, 1],
    transition: {
      scale: { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
    },
  },
  analyzing: {
    y: 0,
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
  perk: {
    y: -10,
    rotate: -4,
    scale: 1.05,
    transition: bouncySpring,
  },
  dozing: {
    y: 7,
    rotate: 5,
    scale: 1,
    transition: { duration: 1.4, ease: "easeInOut" },
  },
};

type HeroGatorState = "idle" | "analyzing" | "perk" | "dozing";

function HeroGator({
  expression,
  state,
}: {
  expression: GatorExpression;
  state: HeroGatorState;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="pointer-events-none absolute left-[12%]"
      style={{ bottom: `calc(100% - ${GATOR_LEDGE_OVERLAP_PX}px)` }}
      data-testid="hero-gator"
      data-expression={expression}
      data-state={state}
    >
      <motion.div
        variants={reducedMotion ? undefined : HEAD_VARIANTS}
        animate={reducedMotion ? undefined : state}
      >
        {/* No key/remount on expression change: swapping only the image src
            keeps the previous face visible until the new one paints. */}
        <GatorPeek
          expression={expression}
          scale={HERO_GATOR_SCALE}
          positioned={false}
          layers="head"
        />
      </motion.div>
      {/* Claws stay planted on the ledge while the head moves. */}
      <div className="absolute inset-0">
        <GatorPeek
          expression={expression}
          scale={HERO_GATOR_SCALE}
          positioned={false}
          layers="claws"
        />
      </div>
    </div>
  );
}

/** Live playable hero: real store, real engines, gator coaching in place. */
export function LandingHeroDemo() {
  const demo = useHeroDemo();
  const reducedMotion = usePrefersReducedMotion();
  const [ctaHover, setCtaHover] = useState(false);
  const [dozing, setDozing] = useState(false);
  const [heldExpression, setHeldExpression] =
    useState<GatorExpression>("neutral-happy");
  const lastWakeRef = useRef(0);
  const dozeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    function arm(): void {
      if (dozeTimer.current != null) window.clearTimeout(dozeTimer.current);
      dozeTimer.current = window.setTimeout(
        () => setDozing(true),
        IDLE_DOZE_MS,
      );
    }
    function wake(): void {
      const now = Date.now();
      if (now - lastWakeRef.current < DOZE_RESET_THROTTLE_MS) return;
      lastWakeRef.current = now;
      setDozing(false);
      arm();
    }
    arm();
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      if (dozeTimer.current != null) window.clearTimeout(dozeTimer.current);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [reducedMotion]);

  const expression: GatorExpression = ctaHover
    ? "mischievous"
    : resolveCoachExpression({
        mood: demo.coach.mood,
        analyzing: demo.coach.analyzing,
        held: heldExpression,
      });
  if (!ctaHover && heldExpression !== expression) {
    setHeldExpression(expression);
  }

  const gatorState: HeroGatorState = ctaHover
    ? "perk"
    : demo.coach.analyzing
      ? "analyzing"
      : dozing
        ? "dozing"
        : "idle";

  const hoverProps = {
    onMouseEnter: () => setCtaHover(true),
    onMouseLeave: () => setCtaHover(false),
    onFocus: () => setCtaHover(true),
    onBlur: () => setCtaHover(false),
  };

  const actions = demo.gameOver ? (
    <>
      <Button size="lg" onClick={demo.startFreshGame} {...hoverProps}>
        Play again
      </Button>
      <Button size="lg" variant="outline" onClick={demo.continueOnFullBoard}>
        Review on the full board
      </Button>
    </>
  ) : (
    <>
      <Button size="lg" onClick={demo.continueOnFullBoard} {...hoverProps}>
        {demo.hasPlayed
          ? "Keep playing on the full board"
          : "Play on the full board"}
      </Button>
      <Link
        className={buttonVariants({ variant: "outline", size: "lg" })}
        href="/play/beginner"
      >
        Start at beginner
      </Link>
    </>
  );

  return (
    <HeroFrame
      gator={<HeroGator expression={expression} state={gatorState} />}
      board={
        <div className="board-checkered" onPointerDown={demo.warmEngines}>
          <ChessboardAdapter
            fen={demo.board.fen}
            interactive={demo.board.interactive}
            lastMove={demo.board.lastMove}
            isCheck={demo.board.isCheck}
            checkSquare={demo.board.checkSquare}
            highlightSquares={demo.board.highlightSquares}
            squareLabels={demo.board.labels}
            arrows={demo.board.arrows}
            onMove={demo.handleMove}
            onPromotionNeeded={(from, to) => {
              // Landing demo keeps it simple: always promote to a queen.
              demo.handleMove({ from, to, promotion: "q" });
            }}
            id="hero-board"
          />
        </div>
      }
      coach={
        <TeachingCard
          insight={demo.coach.insight}
          analyzing={demo.coach.analyzing}
          emptyCopy={demo.coach.emptyCopy}
        />
      }
      notice={demo.notice}
      actions={actions}
    />
  );
}
