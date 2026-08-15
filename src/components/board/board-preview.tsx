"use client";

import { Chessboard } from "react-chessboard";
import { boardSurfaceOptions } from "@/components/board/board-surface";
import { cn } from "@/lib/utils";

export type BoardPreviewProps = {
  fen: string;
  nodeId: string;
  san?: string | null;
  orientation?: "white" | "black";
  className?: string;
};

/** Small non-interactive board for timeline overflow popovers. */
export function BoardPreview({
  fen,
  nodeId,
  san = null,
  orientation = "white",
  className,
}: BoardPreviewProps) {
  const options = {
    id: `preview-${nodeId}`,
    position: fen,
    boardOrientation: orientation,
    allowDragging: false,
    showAnimations: false,
    allowDrawingArrows: false,
    showNotation: false,
    ...boardSurfaceOptions(),
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
