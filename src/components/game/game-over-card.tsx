"use client";

import Image from "next/image";
import {
  type GatorMood,
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";
import { CopyPgnButton } from "@/components/game/copy-pgn-button";
import { Button } from "@/components/ui/button";

export type GameOverCardProps = {
  headline: string;
  detail: string | null;
  mood: GatorMood;
  pgn: string;
  onNewGame: () => void;
  onReview: () => void;
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
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm"
      data-testid="game-over-card"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center shadow-lg">
        <Image
          src={gatorSrc(expression)}
          alt=""
          width={72}
          height={72}
          className="select-none"
          data-expression={expression}
          draggable={false}
        />
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-lg font-semibold">{headline}</h2>
          {detail ? (
            <p className="text-sm text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
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
        </div>
      </div>
    </div>
  );
}
