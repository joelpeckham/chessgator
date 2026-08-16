"use client";

import { motion, type Variants } from "motion/react";
import {
  type GatorMood,
  gatorExpressionFor,
} from "@/components/coach/gator-expression";
import {
  GATOR_LEDGE_OVERLAP_PX,
  gatorDisplaySize,
  gatorPeekLiftPx,
} from "@/components/coach/gator-layout";
import { GatorPeek } from "@/components/coach/gator-peek";
import { CopyPgnButton } from "@/components/game/copy-pgn-button";
import { Button } from "@/components/ui/button";
import { bouncySpring, popSpring } from "@/lib/motion-presets";

export type GameOverCardProps = {
  headline: string;
  detail: string | null;
  mood: GatorMood;
  pgn: string;
  onNewGame: () => void;
  onReview: () => void;
};

const PEEK_SCALE = 0.28;

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 16 },
  shown: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...popSpring, delayChildren: 0.05, staggerChildren: 0.09 },
  },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 10 },
  shown: { opacity: 1, scale: 1, y: 0, transition: popSpring },
};

export function GameOverCard({
  headline,
  detail,
  mood,
  pgn,
  onNewGame,
  onReview,
}: GameOverCardProps) {
  const expression = gatorExpressionFor(mood);
  const head = gatorDisplaySize(expression, PEEK_SCALE);
  const lift = gatorPeekLiftPx(expression, PEEK_SCALE);

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg bg-background/70 p-3 backdrop-blur-sm [clip-path:inset(0_round_var(--radius))]"
      data-testid="game-over-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="relative w-full max-w-xs" style={{ marginTop: lift / 2 }}>
        <motion.div
          className="absolute left-[20%]"
          style={{ bottom: `calc(100% - ${GATOR_LEDGE_OVERLAP_PX}px)` }}
          initial={{ y: head.height }}
          animate={{ y: 0 }}
          transition={{ ...bouncySpring, delay: 0.2 }}
        >
          <GatorPeek
            expression={expression}
            scale={PEEK_SCALE}
            positioned={false}
            layers="head"
          />
        </motion.div>
        <motion.div
          className="relative z-10 flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center shadow-lg"
          variants={CARD_VARIANTS}
          initial="hidden"
          animate="shown"
        >
          <GatorPeek
            expression={expression}
            scale={PEEK_SCALE}
            layers="claws"
            className="left-[20%]"
          />
          <motion.div
            className="flex flex-col gap-0.5"
            variants={ITEM_VARIANTS}
          >
            <h2 className="font-heading text-lg font-semibold">{headline}</h2>
            {detail ? (
              <p className="text-sm text-muted-foreground">{detail}</p>
            ) : null}
          </motion.div>
          <motion.div
            className="flex flex-wrap items-center justify-center gap-1.5"
            variants={ITEM_VARIANTS}
          >
            <Button
              type="button"
              onClick={onNewGame}
              data-testid="game-over-new-game"
            >
              New game
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onReview}
              data-testid="game-over-review"
            >
              Review the game
            </Button>
            <CopyPgnButton pgn={pgn} />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
