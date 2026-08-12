import { getStatusAtNode } from "@/domain/game/tree";
import {
  type Color,
  type GameSession,
  HUMAN_COLOR,
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
): Extract<SessionMode, "playerTurn" | "opponentThinking"> {
  return turn === HUMAN_COLOR ? "playerTurn" : "opponentThinking";
}
