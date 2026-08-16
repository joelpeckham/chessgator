import { getStatusAtNode } from "@/domain/game/tree";
import {
  type Color,
  type GameSession,
  type GameTree,
  type SessionMode,
} from "@/domain/game/types";

/**
 * Drop transient engine/UI modes on reload. Workers and pending jobs are never
 * serialized. In-progress games resume as `"reviewing"` (hydrate transient)
 * until `resumePlay` maps them to playerTurn / opponentThinking. Finished
 * games resume as gameOver. Empty trees resume as loading.
 */
export function normalizeSessionForResume(game: GameSession): GameSession {
  const status = getStatusAtNode(game.tree, game.tree.currentNodeId);
  if (status.isGameOver || game.session.mode === "gameOver") {
    return {
      tree: game.tree,
      session: {
        mode: "gameOver",
        terminalReason: game.session.terminalReason ?? status.reason,
      },
    };
  }

  const hasMoves = Object.keys(game.tree.nodes).length > 1;
  if (!hasMoves) {
    return {
      tree: game.tree,
      session: {
        mode: "loading",
        terminalReason: null,
      },
    };
  }

  return {
    tree: game.tree,
    session: {
      mode: "reviewing",
      terminalReason: null,
    },
  };
}

export function sessionModeForTurn(
  turn: Color,
  humanColor: Color,
): Extract<SessionMode, "playerTurn" | "opponentThinking"> {
  return turn === humanColor ? "playerTurn" : "opponentThinking";
}

/**
 * Mode for a live pointer. Interior opponent-to-move nodes are reviewing
 * (view-only) so the UI never claims Maia is thinking with no request armed.
 */
export function sessionModeForPosition(
  tree: GameTree,
  nodeId: string,
  humanColor: Color,
): Exclude<SessionMode, "loading" | "error" | "analyzing"> {
  const status = getStatusAtNode(tree, nodeId);
  if (status.isGameOver) return "gameOver";
  const turnMode = sessionModeForTurn(status.turn, humanColor);
  if (turnMode === "opponentThinking") {
    const node = tree.nodes[nodeId];
    if (node && node.childIds.length > 0) return "reviewing";
  }
  return turnMode;
}
