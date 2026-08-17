"use client";

import { type KeyboardEvent, useState } from "react";
import { StaticBoard } from "@/components/board/static-board";
import { buttonVariants } from "@/components/ui/button";
import type { GameColor } from "@/lib/game-href";
import { cn } from "@/lib/utils";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type StepperPly = {
  san: string;
  fenAfter: string;
};

export function GameStepper({
  plies,
  initialPly = 0,
  orientation = "white",
}: {
  plies: readonly StepperPly[];
  /** 1-based ply to open on. 0 shows the start position. */
  initialPly?: number;
  orientation?: GameColor;
}) {
  const last = plies.length;
  const start = Math.min(last, Math.max(0, initialPly));
  const [ply, setPly] = useState(start);
  const fen = ply === 0 ? START_FEN : (plies[ply - 1]?.fenAfter ?? START_FEN);
  const label =
    ply === 0
      ? "Start"
      : `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."} ${plies[ply - 1]?.san ?? ""}`;

  function onStepperKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPly((current) => Math.max(0, current - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPly((current) => Math.min(last, current + 1));
    }
  }

  return (
    <div className="space-y-3">
      <StaticBoard
        fen={fen}
        title={`Position after ${label}`}
        orientation={orientation}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === 0}
          onClick={() => setPly(0)}
          onKeyDown={onStepperKey}
        >
          Start
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === 0}
          onClick={() => setPly((current) => Math.max(0, current - 1))}
          onKeyDown={onStepperKey}
        >
          Previous
        </button>
        <p className="min-w-28 text-center text-sm text-muted-foreground">
          {label}
        </p>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === last}
          onClick={() => setPly((current) => Math.min(last, current + 1))}
          onKeyDown={onStepperKey}
        >
          Next
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === last}
          onClick={() => setPly(last)}
          onKeyDown={onStepperKey}
        >
          End
        </button>
      </div>
    </div>
  );
}
