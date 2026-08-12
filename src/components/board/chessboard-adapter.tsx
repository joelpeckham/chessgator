"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
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
  const labelBySquare = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of squareLabels) {
      map.set(entry.square, entry.text);
    }
    return map;
  }, [squareLabels]);
  const highlightSet = useMemo(
    () => new Set(highlightSquares),
    [highlightSquares],
  );
  const ghostSet = useMemo(() => new Set(ghostSquares), [ghostSquares]);

  const destinations = useMemo(() => {
    if (!selectedSquare || !interactive) return new Set<string>();
    return new Set(legalDestinations(fen, selectedSquare));
  }, [fen, interactive, selectedSquare]);

  const boardArrows = useMemo(
    () =>
      dedupeBoardArrows(arrows).map((arrow) => ({
        startSquare: arrow.from,
        endSquare: arrow.to,
        color: arrow.color ?? "var(--foreground)",
      })),
    [arrows],
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = {
        background: "color-mix(in oklch, var(--primary) 18%, transparent)",
        outline:
          "2px solid color-mix(in oklch, var(--primary) 55%, transparent)",
        outlineOffset: "-2px",
      };
      styles[lastMove.to] = {
        background: "color-mix(in oklch, var(--primary) 28%, transparent)",
        outline:
          "2px solid color-mix(in oklch, var(--primary) 70%, transparent)",
        outlineOffset: "-2px",
      };
    }

    for (const square of highlightSet) {
      styles[square] = {
        ...styles[square],
        outline: "2px dashed var(--foreground)",
        outlineOffset: "-3px",
        background:
          styles[square]?.background ??
          "color-mix(in oklch, var(--accent) 22%, transparent)",
      };
    }

    for (const square of ghostSet) {
      styles[square] = {
        ...styles[square],
        outline: "2px dotted var(--foreground)",
        outlineOffset: "-4px",
        background:
          styles[square]?.background ??
          "color-mix(in oklch, var(--muted) 70%, transparent)",
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        outline: "2px dashed var(--foreground)",
        outlineOffset: "-4px",
      };
    }

    for (const square of destinations) {
      styles[square] = {
        ...styles[square],
        outline:
          styles[square]?.outline ??
          "2px solid color-mix(in oklch, var(--foreground) 35%, transparent)",
        outlineOffset: "-2px",
      };
    }

    if (isCheck && checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        background: "color-mix(in oklch, var(--destructive) 35%, transparent)",
        outline: "2px solid var(--destructive)",
        outlineOffset: "-2px",
      };
    }

    return styles;
  }, [
    checkSquare,
    destinations,
    ghostSet,
    highlightSet,
    isCheck,
    lastMove,
    selectedSquare,
  ]);

  const options = useMemo(() => {
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
      if (origins.length > 0) {
        setSelection({ fen, square });
      } else {
        setSelection({ fen, square: null });
      }
    }

    return {
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
      }: SquareHandlerArgs & { children?: ReactNode }) => {
        const isSelected = selectedSquare === square;
        const isTarget = destinations.has(square);
        const isLast =
          lastMove != null &&
          (lastMove.from === square || lastMove.to === square);
        const inCheck = isCheck && checkSquare === square;
        const isHint = highlightSet.has(square);
        const isGhost = ghostSet.has(square);
        const annotation = labelBySquare.get(square) ?? null;

        function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
          if (!interactive) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activateSquare(square);
          }
          if (event.key === "Escape") {
            setSelection({ fen, square: null });
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
                className="pointer-events-none absolute bottom-0.5 right-0.5 rounded-sm bg-background/90 px-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-foreground ring-1 ring-foreground/30"
                data-testid={`square-label-${square}`}
              >
                {annotation}
              </span>
            ) : null}
          </div>
        );
      },
    };
  }, [
    boardArrows,
    checkSquare,
    destinations,
    fen,
    ghostSet,
    highlightSet,
    id,
    interactive,
    isCheck,
    labelBySquare,
    lastMove,
    onMove,
    onPromotionNeeded,
    reducedMotion,
    selectedSquare,
    squareStyles,
  ]);

  return (
    <div
      className={cn("chessboard-adapter aspect-square", className)}
      data-testid="chessboard"
    >
      <Chessboard options={options} />
    </div>
  );
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
