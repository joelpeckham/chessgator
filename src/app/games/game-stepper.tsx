"use client";

import { useEffect, useState } from "react";
import { StaticBoard } from "@/components/board/static-board";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type StepperPly = {
  san: string;
  fenAfter: string;
};

export function GameStepper({
  plies,
  initialPly = 0,
}: {
  plies: readonly StepperPly[];
  /** 1-based ply to open on. 0 shows the start position. */
  initialPly?: number;
}) {
  const last = plies.length;
  const start = Math.min(last, Math.max(0, initialPly));
  const [ply, setPly] = useState(start);
  const fen = ply === 0 ? START_FEN : (plies[ply - 1]?.fenAfter ?? START_FEN);
  const label =
    ply === 0
      ? "Start"
      : `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."} ${plies[ply - 1]?.san ?? ""}`;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        setPly((current) => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight") {
        setPly((current) => Math.min(last, current + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  return (
    <div className="space-y-3">
      <StaticBoard fen={fen} title={`Position after ${label}`} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === 0}
          onClick={() => setPly(0)}
        >
          Start
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === 0}
          onClick={() => setPly((current) => current - 1)}
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
          onClick={() => setPly((current) => current + 1)}
        >
          Next
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          disabled={ply === last}
          onClick={() => setPly(last)}
        >
          End
        </button>
      </div>
    </div>
  );
}
