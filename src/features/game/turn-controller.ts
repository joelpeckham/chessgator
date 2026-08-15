import {
  type Color,
  type GameTree,
  getCurrentNode,
  getStatusAtNode,
  getTurn,
  isHumanTurn,
  type SessionMode,
} from "@/domain/game";

export type OpponentTarget = {
  nodeId: string;
  fen: string;
};

export function opponentTargetKey(
  target: OpponentTarget | null,
): string | null {
  if (!target) return null;
  return target.nodeId;
}

/**
 * Maia replies after a human move, and when navigation lands on a leaf
 * where it is the opponent's turn. Interior opponent-to-move nodes are view-only.
 */
export function deriveOpponentTarget(args: {
  liveMode: SessionMode;
  liveTree: GameTree;
}): OpponentTarget | null {
  if (args.liveMode !== "opponentThinking") return null;
  const node = getCurrentNode(args.liveTree);
  if (node.childIds.length > 0) return null;
  const status = getStatusAtNode(args.liveTree, node.id);
  if (status.isGameOver) return null;
  return { nodeId: node.id, fen: node.fen };
}

export function deriveBoardInteractivity(args: {
  liveMode: SessionMode;
  liveFen: string;
  humanColor: Color;
  maiaFailed: boolean;
}): boolean {
  if (args.maiaFailed) return false;
  if (args.liveMode !== "playerTurn") return false;
  return isHumanTurn(getTurn(args.liveFen), args.humanColor);
}
