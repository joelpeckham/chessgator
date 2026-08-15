"use client";

import { motion, type Variants } from "motion/react";
import Image from "next/image";
import {
  type GatorMood,
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";
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

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 16 },
  shown: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...popSpring, delayChildren: 0.05, staggerChildren: 0.09 },
  },
};

const GATOR_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.4, y: 8 },
  shown: { opacity: 1, scale: 1, y: 0, transition: bouncySpring },
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

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm"
      data-testid="game-over-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <motion.div
        className="flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center shadow-lg"
        variants={CARD_VARIANTS}
        initial="hidden"
        animate="shown"
      >
        <motion.div variants={GATOR_VARIANTS}>
          <Image
            src={gatorSrc(expression)}
            alt=""
            width={72}
            height={72}
            className="select-none"
            data-expression={expression}
            draggable={false}
          />
        </motion.div>
        <motion.div className="flex flex-col gap-0.5" variants={ITEM_VARIANTS}>
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
    </motion.div>
  );
}
