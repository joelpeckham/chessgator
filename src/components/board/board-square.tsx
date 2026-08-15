"use client";

import { type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function describeSquare(args: {
  square: string;
  isSelected: boolean;
  isTarget: boolean;
  isLast: boolean;
  inCheck: boolean;
  isHint: boolean;
  isGhost: boolean;
  annotation: string | null;
}): string {
  const flags: string[] = [];
  if (args.isSelected) flags.push("selected");
  if (args.isTarget) flags.push("legal destination");
  if (args.isLast) flags.push("last move");
  if (args.inCheck) flags.push("check");
  if (args.isHint) flags.push("hint focus");
  if (args.isGhost) flags.push("variation ghost");
  if (args.annotation) flags.push(args.annotation);
  return flags.length > 0 ? `${args.square}, ${flags.join(", ")}` : args.square;
}

export function BoardSquare({
  square,
  children,
  interactive,
  selectedSquare,
  destinations,
  lastMove,
  isCheck,
  checkSquare,
  highlightSquares,
  ghostSquares,
  annotation,
  onActivate,
  onClearSelection,
}: {
  square: string;
  children?: ReactNode;
  interactive: boolean;
  selectedSquare: string | null;
  destinations: ReadonlySet<string>;
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  checkSquare: string | null;
  highlightSquares: ReadonlySet<string>;
  ghostSquares: ReadonlySet<string>;
  annotation: string | null;
  onActivate: (square: string) => void;
  onClearSelection: () => void;
}) {
  const isSelected = selectedSquare === square;
  const isTarget = destinations.has(square);
  const isLast =
    lastMove != null && (lastMove.from === square || lastMove.to === square);
  const inCheck = isCheck && checkSquare === square;
  const isHint = highlightSquares.has(square);
  const isGhost = ghostSquares.has(square);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(square);
    }
    if (event.key === "Escape") {
      onClearSelection();
    }
  }

  return (
    <div
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label={describeSquare({
        square,
        isSelected,
        isTarget,
        isLast,
        inCheck,
        isHint,
        isGhost,
        annotation,
      })}
      aria-pressed={isSelected}
      data-square={square}
      data-selected={isSelected ? "true" : "false"}
      data-legal-target={isTarget ? "true" : "false"}
      data-hint-square={isHint ? "true" : "false"}
      data-ghost-square={isGhost ? "true" : "false"}
      className={cn(
        "relative h-full w-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
      data-board-square="true"
      onKeyDown={onKeyDown}
    >
      {children}
      {isTarget ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="size-2.5 rounded-full bg-foreground/50 ring-1 ring-background/80" />
        </span>
      ) : null}
      {annotation ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0.5 bottom-0.5 rounded-sm bg-background/90 px-1 py-px font-mono text-[0.7rem] tracking-wide text-foreground uppercase ring-1 ring-foreground/30"
          data-testid={`square-label-${square}`}
        >
          {annotation}
        </span>
      ) : null}
    </div>
  );
}
