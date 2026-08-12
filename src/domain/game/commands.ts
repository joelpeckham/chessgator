import {
  createSessionState,
  transitionSession,
} from "@/domain/game/session";
import { DEFAULT_POSITION } from "@/domain/game/rules";
import {
  createInitialTree,
  getCurrentNode,
  getStatusAtNode,
  jumpToNode,
  playMoveOnTree,
  takebackOne,
} from "@/domain/game/tree";
import type {
  GameSession,
  GameStatus,
  MoveInput,
  SessionMode,
} from "@/domain/game/types";

export type CommandResult =
  | { ok: true; session: GameSession; status: GameStatus }
  | { ok: false; session: GameSession; error: string };

function withStatus(session: GameSession): CommandResult {
  return {
    ok: true,
    session,
    status: getStatusAtNode(session.tree, session.tree.currentNodeId),
  };
}

function fail(session: GameSession, error: string): CommandResult {
  return { ok: false, session, error };
}

export function createGameSession(options?: {
  fen?: string;
  mode?: SessionMode;
}): GameSession {
  return {
    tree: createInitialTree(options?.fen ?? DEFAULT_POSITION),
    session: createSessionState(options?.mode ?? "playerTurn"),
  };
}

export function startGame(fen?: string): CommandResult {
  return withStatus(createGameSession({ fen, mode: "playerTurn" }));
}

/**
 * Play a move at the current node. Reuses an existing branch when the same
 * UCI was already explored. Advances session mode based on game-over / turn.
 */
export function playMove(
  game: GameSession,
  input: MoveInput,
  options?: { afterMode?: SessionMode; asVariation?: boolean },
): CommandResult {
  const playable: SessionMode[] = [
    "playerTurn",
    "opponentThinking",
    "reviewing",
    "analyzing",
  ];
  if (!playable.includes(game.session.mode)) {
    return fail(game, `Cannot play a move while in mode ${game.session.mode}`);
  }

  const played = playMoveOnTree(game.tree, game.tree.currentNodeId, input, {
    asVariation: options?.asVariation,
  });
  if (!played) {
    return fail(game, "Illegal move");
  }

  const status = getStatusAtNode(played.tree, played.tree.currentNodeId);
  let mode: SessionMode =
    options?.afterMode ??
    (game.session.mode === "opponentThinking" ? "playerTurn" : "opponentThinking");

  if (status.isGameOver) {
    mode = "gameOver";
  }

  const transitioned = transitionSession(
    { ...game.session, mode: game.session.mode },
    mode,
    status.isGameOver ? { terminalReason: status.reason } : undefined,
  );

  // When already gameOver → gameOver is allowed via same-mode; otherwise force.
  if (!transitioned.ok && mode === "gameOver") {
    return {
      ok: true,
      session: {
        tree: played.tree,
        session: {
          mode: "gameOver",
          errorMessage: null,
          terminalReason: status.reason,
        },
      },
      status,
    };
  }

  if (!transitioned.ok) {
    // Mode may already equal target (e.g. reviewing → reviewing after branch jump play).
    if (game.session.mode === mode) {
      return {
        ok: true,
        session: { tree: played.tree, session: game.session },
        status,
      };
    }
    return fail(game, transitioned.reason);
  }

  return {
    ok: true,
    session: { tree: played.tree, session: transitioned.session },
    status,
  };
}

export function jumpToGameNode(
  game: GameSession,
  nodeId: string,
): CommandResult {
  const nextTree = jumpToNode(game.tree, nodeId);
  if (!nextTree) {
    return fail(game, `Unknown node: ${nodeId}`);
  }

  const status = getStatusAtNode(nextTree, nodeId);
  let session = game.session;

  if (status.isGameOver && session.mode !== "gameOver") {
    const toGameOver = transitionSession(session, "gameOver", {
      terminalReason: status.reason,
    });
    if (toGameOver.ok) {
      session = toGameOver.session;
    }
  } else if (!status.isGameOver && session.mode === "gameOver") {
    const toReview = transitionSession(session, "reviewing");
    if (toReview.ok) {
      session = toReview.session;
    }
  } else if (
    session.mode === "playerTurn" ||
    session.mode === "opponentThinking" ||
    session.mode === "analyzing"
  ) {
    const toReview = transitionSession(session, "reviewing");
    if (toReview.ok) {
      session = toReview.session;
    }
  }

  return {
    ok: true,
    session: { tree: nextTree, session },
    status,
  };
}

/** Take back one ply (pointer to parent). Tree history is preserved. */
export function takeback(game: GameSession): CommandResult {
  const nextTree = takebackOne(game.tree);
  if (!nextTree) {
    return fail(game, "Nothing to take back");
  }

  let session = game.session;
  if (session.mode === "gameOver" || session.mode === "analyzing") {
    const toReview = transitionSession(session, "reviewing");
    if (toReview.ok) {
      session = toReview.session;
    } else {
      session = {
        mode: "reviewing",
        errorMessage: null,
        terminalReason: null,
      };
    }
  } else if (session.mode === "playerTurn" || session.mode === "opponentThinking") {
    const toReview = transitionSession(session, "reviewing");
    if (toReview.ok) {
      session = toReview.session;
    }
  }

  return withStatus({ tree: nextTree, session });
}

/**
 * Take back the last move and return to a state ready for a different try.
 * Branches remain in the tree; the pointer moves to the parent.
 * Assumes the human plays White (v1 product default).
 */
export function retryMove(game: GameSession): CommandResult {
  const nextTree = takebackOne(game.tree);
  if (!nextTree) {
    return fail(game, "Nothing to retry");
  }

  const status = getStatusAtNode(nextTree, nextTree.currentNodeId);
  const targetMode: SessionMode =
    status.turn === "w" ? "playerTurn" : "opponentThinking";

  const retryable: SessionMode[] = [
    "playerTurn",
    "opponentThinking",
    "analyzing",
    "reviewing",
    "gameOver",
  ];
  if (!retryable.includes(game.session.mode)) {
    return fail(game, `Cannot retry while in mode ${game.session.mode}`);
  }

  return withStatus({
    tree: nextTree,
    session: {
      mode: targetMode,
      errorMessage: null,
      terminalReason: null,
    },
  });
}

export function resign(
  game: GameSession,
  winner: "white" | "black" = "black",
): CommandResult {
  if (game.session.mode === "loading" || game.session.mode === "error") {
    return fail(game, `Cannot resign while in mode ${game.session.mode}`);
  }

  return {
    ok: true,
    session: {
      tree: game.tree,
      session: {
        mode: "gameOver",
        errorMessage: null,
        terminalReason: "resignation",
      },
    },
    status: {
      ...getStatusAtNode(game.tree, game.tree.currentNodeId),
      isGameOver: true,
      result: winner === "white" ? "whiteWins" : "blackWins",
      reason: "resignation",
    },
  };
}

export function setSessionMode(
  game: GameSession,
  mode: SessionMode,
  options?: { errorMessage?: string | null },
): CommandResult {
  const transitioned = transitionSession(game.session, mode, options);
  if (!transitioned.ok) {
    return fail(game, transitioned.reason);
  }
  return withStatus({ tree: game.tree, session: transitioned.session });
}

export function currentStatus(game: GameSession): GameStatus {
  return getStatusAtNode(game.tree, game.tree.currentNodeId);
}

export function currentFen(game: GameSession): string {
  return getCurrentNode(game.tree).fen;
}
