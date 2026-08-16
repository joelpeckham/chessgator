import { lastMoveSquares } from "@/components/board/move-utils";
import type { DecisionGraph } from "@/components/timeline/decision-types";
import { findKingSquare, getStatus } from "@/domain/game";

export type BoardPreview = {
  fen: string;
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  checkSquare: string | null;
};

/** Hover preview for a timeline node, or null when the live board should stay. */
export function resolveBoardPreview(
  graph: DecisionGraph,
  hoverNodeId: string | null,
  focusedNodeId: string,
): BoardPreview | null {
  if (!hoverNodeId || hoverNodeId === focusedNodeId) return null;
  const node = graph.nodes.find((item) => item.id === hoverNodeId);
  if (!node || node.isCurrent) return null;
  const status = getStatus(node.fen);
  const isCheck = status.isCheck && !status.isGameOver;
  return {
    fen: node.fen,
    lastMove: lastMoveSquares(node.uci),
    isCheck,
    checkSquare: isCheck ? findKingSquare(node.fen, status.turn) : null,
  };
}
