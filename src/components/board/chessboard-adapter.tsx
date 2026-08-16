"use client";

import { type ReactNode, useState } from "react";
import {
  Chessboard,
  defaultArrowOptions,
  type SquareHandlerArgs,
} from "react-chessboard";
import {
  type BoardArrow,
  dedupeBoardArrows,
} from "@/components/board/arrow-utils";
import { BoardSquare } from "@/components/board/board-square";
import { boardSurfaceOptions } from "@/components/board/board-surface";
import {
  type BoardMove,
  findMove,
  legalDestinations,
  moveRequiresPromotion,
} from "@/components/board/move-utils";
import type { PieceSymbol } from "@/domain/game";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { cn } from "@/lib/utils";

export type { BoardArrow } from "@/components/board/arrow-utils";

export type BoardSquareLabel = {
  square: string;
  text: string;
};

export type ChessboardAdapterProps = {
  fen: string;
  interactive: boolean;
  orientation?: "white" | "black";
  lastMove?: { from: string; to: string } | null;
  isCheck?: boolean;
  checkSquare?: string | null;
  /** Coaching / hint highlights (paired with labels — not color-only). */
  highlightSquares?: string[];
  squareLabels?: BoardSquareLabel[];
  arrows?: BoardArrow[];
  onMove: (move: BoardMove) => boolean;
  onPromotionNeeded?: (from: string, to: string) => void;
  className?: string;
  id?: string;
};

/**
 * Thin adapter around react-chessboard v5 so game logic never depends on
 * library-specific APIs. Supports drag, click-to-move, and keyboard square activation.
 */
export function ChessboardAdapter({
  fen,
  interactive,
  orientation = "white",
  lastMove = null,
  isCheck = false,
  checkSquare = null,
  highlightSquares = [],
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

  if (selection.fen !== fen) {
    setSelection({ fen, square: null });
  }

  const selectedSquare = selection.square;
  const labelBySquare = new Map(
    squareLabels.map((entry) => [entry.square, entry.text] as const),
  );
  const highlightSet = new Set(highlightSquares);
  const destinations =
    selectedSquare && interactive
      ? new Set(legalDestinations(fen, selectedSquare))
      : new Set<string>();
  const boardArrows = dedupeBoardArrows(arrows).map((arrow) => ({
    startSquare: arrow.from,
    endSquare: arrow.to,
    color: arrow.color ?? "var(--foreground)",
  }));

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
    boardOrientation: orientation,
    allowDragging: interactive,
    showAnimations: !reducedMotion,
    animationDurationInMs: reducedMotion ? 0 : 200,
    allowDrawingArrows: false,
    clearArrowsOnClick: false,
    clearArrowsOnPositionChange: false,
    arrows: boardArrows,
    // Shaft + head must be opaque; layer opacity in CSS composites them as one.
    arrowOptions: {
      ...defaultArrowOptions,
      opacity: 1,
      activeOpacity: 1,
    },
    showNotation: true,
    ...boardSurfaceOptions({ transparent: true }),
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
      data-orientation={orientation}
    >
      <Chessboard options={options} />
    </div>
  );
}
