"use client";

import { Chessboard } from "react-chessboard";
import { cn } from "@/lib/utils";

export type BoardPreviewProps = {
  fen: string;
  san?: string | null;
  className?: string;
};

/** Small non-interactive board for timeline hover/focus previews. */
export function BoardPreview({
  fen,
  san = null,
  className,
}: BoardPreviewProps) {
  const options = {
    id: `preview-${fen.slice(0, 24)}`,
    position: fen,
    boardOrientation: "white" as const,
    allowDragging: false,
    showAnimations: false,
    allowDrawingArrows: false,
    showNotation: false,
    boardStyle: {
      borderRadius: "var(--radius)",
      width: "100%",
    },
    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
    lightSquareStyle: { backgroundColor: "var(--board-light)" },
  };

  return (
    <div
      className={cn("flex w-36 flex-col gap-2", className)}
      data-testid="board-preview"
    >
      <div className="aspect-square w-full">
        <Chessboard options={options} />
      </div>
      {san ? (
        <p className="text-center font-mono text-xs text-muted-foreground">
          {san}
        </p>
      ) : null}
    </div>
  );
}
