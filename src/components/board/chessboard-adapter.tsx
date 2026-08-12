"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from "react";
import { Chessboard, type SquareHandlerArgs } from "react-chessboard";
import {
  type BoardArrow,
  dedupeBoardArrows,
} from "@/components/board/arrow-utils";
import {
  type BoardMove,
  findMove,
  legalDestinations,
  moveRequiresPromotion,
} from "@/components/board/move-utils";
import type { PieceSymbol } from "@/domain/game";
import { cn } from "@/lib/utils";

export type { BoardArrow } from "@/components/board/arrow-utils";

export type BoardSquareLabel = {
  square: string;
  text: string;
};

export type ChessboardAdapterProps = {
  fen: string;
  interactive: boolean;
  lastMove?: { from: string; to: string } | null;
  isCheck?: boolean;
  checkSquare?: string | null;
  /** Coaching / hint highlights (paired with labels — not color-only). */
  highlightSquares?: string[];
  /** Ghost / variation squares (pattern + label, not color-only). */
  ghostSquares?: string[];
  squareLabels?: BoardSquareLabel[];
  arrows?: BoardArrow[];
  onMove: (move: BoardMove) => boolean;
  onPromotionNeeded?: (from: string, to: string) => void;
  className?: string;
  id?: string;
};

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
}

function buildSquareStyles(args: {
  lastMove: { from: string; to: string } | null;
  highlightSquares: ReadonlySet<string>;
  ghostSquares: ReadonlySet<string>;
  selectedSquare: string | null;
  destinations: ReadonlySet<string>;
  isCheck: boolean;
  checkSquare: string | null;
}): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};

  if (args.lastMove) {
    styles[args.lastMove.from] = {
      background: "color-mix(in oklch, var(--primary) 18%, transparent)",
      outline: "2px solid color-mix(in oklch, var(--primary) 55%, transparent)",
      outlineOffset: "-2px",
    };
    styles[args.lastMove.to] = {
      background: "color-mix(in oklch, var(--primary) 28%, transparent)",
      outline: "2px solid color-mix(in oklch, var(--primary) 70%, transparent)",
      outlineOffset: "-2px",
    };
  }

  for (const square of args.highlightSquares) {
    styles[square] = {
      ...styles[square],
      outline: "2px dashed var(--foreground)",
      outlineOffset: "-3px",
      background:
        styles[square]?.background ??
        "color-mix(in oklch, var(--accent) 22%, transparent)",
    };
  }

  for (const square of args.ghostSquares) {
    styles[square] = {
      ...styles[square],
      outline: "2px dotted var(--foreground)",
      outlineOffset: "-4px",
      background:
        styles[square]?.background ??
        "color-mix(in oklch, var(--muted) 70%, transparent)",
    };
  }

  if (args.selectedSquare) {
    styles[args.selectedSquare] = {
      ...styles[args.selectedSquare],
      outline: "2px dashed var(--foreground)",
      outlineOffset: "-4px",
    };
  }

  for (const square of args.destinations) {
    styles[square] = {
      ...styles[square],
      outline:
        styles[square]?.outline ??
        "2px solid color-mix(in oklch, var(--foreground) 35%, transparent)",
      outlineOffset: "-2px",
    };
  }

  if (args.isCheck && args.checkSquare) {
    styles[args.checkSquare] = {
      ...styles[args.checkSquare],
      background: "color-mix(in oklch, var(--destructive) 35%, transparent)",
      outline: "2px solid var(--destructive)",
      outlineOffset: "-2px",
    };
  }

  return styles;
}

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

function BoardSquare({
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
          className="pointer-events-none absolute right-0.5 bottom-0.5 rounded-sm bg-background/90 px-0.5 font-mono text-[0.55rem] tracking-wide text-foreground uppercase ring-1 ring-foreground/30"
          data-testid={`square-label-${square}`}
        >
          {annotation}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Thin adapter around react-chessboard v5 so game logic never depends on
 * library-specific APIs. Supports drag, click-to-move, and keyboard square activation.
 */
export function ChessboardAdapter({
  fen,
  interactive,
  lastMove = null,
  isCheck = false,
  checkSquare = null,
  highlightSquares = [],
  ghostSquares = [],
  squareLabels = [],
  arrows = [],
  onMove,
  onPromotionNeeded,
  className,
  id = "chessgator-board",
}: ChessboardAdapterProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [selection, setSelection] = useState<{
    fen: string;
    square: string | null;
  }>({ fen, square: null });

  const selectedSquare = selection.fen === fen ? selection.square : null;
  const labelBySquare = new Map(
    squareLabels.map((entry) => [entry.square, entry.text] as const),
  );
  const highlightSet = new Set(highlightSquares);
  const ghostSet = new Set(ghostSquares);
  const destinations =
    selectedSquare && interactive
      ? new Set(legalDestinations(fen, selectedSquare))
      : new Set<string>();
  const boardArrows = dedupeBoardArrows(arrows).map((arrow) => ({
    startSquare: arrow.from,
    endSquare: arrow.to,
    color: arrow.color ?? "var(--foreground)",
  }));
  const squareStyles = buildSquareStyles({
    lastMove,
    highlightSquares: highlightSet,
    ghostSquares: ghostSet,
    selectedSquare,
    destinations,
    isCheck,
    checkSquare,
  });

  function attemptMove(
    from: string,
    to: string,
    promotion?: PieceSymbol,
  ): boolean {
    if (!interactive) return false;
    if (moveRequiresPromotion(fen, from, to) && !promotion) {
      onPromotionNeeded?.(from, to);
      return false;
    }
    const legal = findMove(fen, from, to, promotion);
    if (!legal) return false;
    const ok = onMove({
      from: legal.from,
      to: legal.to,
      promotion: legal.promotion,
    });
    if (ok) setSelection({ fen, square: null });
    return ok;
  }

  function activateSquare(square: string): void {
    if (!interactive) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelection({ fen, square: null });
        return;
      }
      if (destinations.has(square)) {
        attemptMove(selectedSquare, square);
        return;
      }
    }

    const origins = legalDestinations(fen, square);
    setSelection({
      fen,
      square: origins.length > 0 ? square : null,
    });
  }

  const options = {
    id,
    position: fen,
    boardOrientation: "white" as const,
    allowDragging: interactive,
    showAnimations: !reducedMotion,
    animationDurationInMs: reducedMotion ? 0 : 200,
    allowDrawingArrows: false,
    clearArrowsOnClick: false,
    clearArrowsOnPositionChange: false,
    arrows: boardArrows,
    showNotation: true,
    boardStyle: {
      borderRadius: "var(--radius)",
      width: "100%",
    },
    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
    lightSquareStyle: { backgroundColor: "var(--board-light)" },
    squareStyles,
    canDragPiece: ({ square }: { square: string | null }) => {
      if (!interactive || !square) return false;
      return legalDestinations(fen, square).length > 0;
    },
    onPieceDrop: ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare) return false;
      return attemptMove(sourceSquare, targetSquare);
    },
    onSquareClick: ({ square }: SquareHandlerArgs) => {
      activateSquare(square);
    },
    onPieceClick: ({ square }: { square: string | null }) => {
      if (square) activateSquare(square);
    },
    squareRenderer: ({
      square,
      children,
    }: SquareHandlerArgs & { children?: ReactNode }) => (
      <BoardSquare
        square={square}
        interactive={interactive}
        selectedSquare={selectedSquare}
        destinations={destinations}
        lastMove={lastMove}
        isCheck={isCheck}
        checkSquare={checkSquare}
        highlightSquares={highlightSet}
        ghostSquares={ghostSet}
        annotation={labelBySquare.get(square) ?? null}
        onActivate={activateSquare}
        onClearSelection={() => setSelection({ fen, square: null })}
      >
        {children}
      </BoardSquare>
    ),
  };

  return (
    <div
      className={cn("chessboard-adapter aspect-square", className)}
      data-testid="chessboard"
    >
      <Chessboard options={options} />
    </div>
  );
}
