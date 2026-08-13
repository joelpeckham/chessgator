import type { MoveAnalysisEvidence, ProjectedLine } from "@/domain/analysis";
import { projectUciLine } from "@/domain/analysis";
import {
  createVariationExplorer,
  type GameMove,
  type GameNode,
  type GameTree,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  isHumanTurn,
  type PieceSymbol,
  type SessionMode,
  sessionModeForTurn,
  tryInsteadFromExplorer,
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import type { CoachingController } from "@/features/game/coaching-controller";
import { useGameStore } from "@/features/game/game-store";
import type { MaiaSession } from "@/features/game/maia-session";

/**
 * Commit the coach's suggested first ply as a real alternate, pruning ghost
 * siblings under the origin. Uses the variation explorer so Try instead never
 * leaves exploration debris on the tree.
 */
export function commitTryInstead(args: {
  tree: GameTree;
  originNodeId: string;
  lineUci: readonly string[];
  suggestedMoveUci: string;
}): { tree: GameTree; node: GameNode } | null {
  const explorerLine =
    args.lineUci.length > 0 ? args.lineUci : [args.suggestedMoveUci];
  const started =
    createVariationExplorer(args.tree, args.originNodeId, explorerLine) ??
    createVariationExplorer(args.tree, args.originNodeId, [
      args.suggestedMoveUci,
    ]);
  if (!started) return null;
  return tryInsteadFromExplorer(started.tree, started.explorer, {
    commitUci: args.suggestedMoveUci,
  });
}

export function buildTutorLine(
  tree: GameTree,
  insight: TeachingInsight | null,
  evidence: MoveAnalysisEvidence | null,
): ProjectedLine | null {
  if (!insight?.lineUci.length || !evidence) return null;
  if (!insight.suggestedMoveUci) return null;
  const playedUci = evidence.playedMove.uci.toLowerCase();
  const firstPly = insight.lineUci[0]?.toLowerCase();
  if (!firstPly || firstPly === playedUci) return null;

  const analyzed = getNode(tree, evidence.gameNodeId);
  const originId = analyzed?.parentId ?? tree.rootId;
  const origin = getNode(tree, originId);
  if (!origin) return null;
  return projectUciLine({
    rootFen: origin.fen,
    rootNodeId: originId,
    lineUci: insight.lineUci,
    kind: "tutor",
    maxPlies: 5,
  });
}

function isOpponentTurnAt(nodeId: string): boolean {
  const latest = useGameStore.getState();
  return (
    latest.session.mode === "opponentThinking" &&
    latest.tree.currentNodeId === nodeId
  );
}

/** Cancelled / superseded requests return null with phase !== failed. */
function surfaceOpponentEngineFailure(
  maia: MaiaSession,
  fallback: string,
): void {
  if (useGameStore.getState().session.mode !== "opponentThinking") return;
  if (maia.getState().phase !== "failed") return;
  useGameStore.getState().setMode("error", maia.getState().message ?? fallback);
}

export async function requestOpponentMove(args: {
  maia: MaiaSession;
  requestId: string;
}): Promise<void> {
  const state = useGameStore.getState();
  if (state.session.mode !== "opponentThinking") return;

  const nodeId = state.tree.currentNodeId;
  const nodeFen = getCurrentNode(state.tree).fen;

  const ready = await args.maia.whenReady();
  if (!ready) {
    surfaceOpponentEngineFailure(
      args.maia,
      args.maia.getState().message ?? "Maia failed to start",
    );
    return;
  }
  if (!isOpponentTurnAt(nodeId)) return;

  const result = await args.maia.chooseMove({
    requestId: args.requestId,
    gameNodeId: nodeId,
    fen: nodeFen,
    selfElo: useGameStore.getState().preferences.maiaElo,
    oppoElo: useGameStore.getState().preferences.maiaElo,
    movetimeMs: 400,
  });

  if (!result) {
    surfaceOpponentEngineFailure(
      args.maia,
      args.maia.getState().message ?? "Maia failed to move",
    );
    return;
  }
  if (!isOpponentTurnAt(result.gameNodeId)) return;

  const applied = useGameStore.getState().playMove(result.moveUci);
  if (!applied) {
    const latest = useGameStore.getState();
    latest.setMode(
      "error",
      latest.lastError ?? "Maia returned an illegal move",
    );
  }
}

export async function runPostMoveCoaching(args: {
  coach: CoachingController;
  fenBefore: string;
  gameNodeId: string;
  playedMove: GameMove;
  coachUnavailable: string | null;
  requestId: string;
  onReadyForOpponent: () => void;
}): Promise<void> {
  const node = getNode(useGameStore.getState().tree, args.gameNodeId);
  if (!node) return;

  if (!args.coachUnavailable && args.coach.getState().phase !== "failed") {
    await args.coach.analyzePlayerMove({
      requestId: args.requestId,
      gameNodeId: args.gameNodeId,
      fenBefore: args.fenBefore,
      fenAfter: node.fen,
      playedMove: args.playedMove,
      previousMove: node.parentId
        ? (getNode(useGameStore.getState().tree, node.parentId)?.move ?? null)
        : null,
    });
  }

  const latest = useGameStore.getState();
  if (latest.tree.currentNodeId !== args.gameNodeId) return;
  if (latest.session.mode !== "analyzing") return;
  const status = getStatusAtNode(latest.tree, args.gameNodeId);
  if (status.isGameOver) {
    latest.setMode("gameOver");
    return;
  }

  latest.setMode("opponentThinking");
  args.onReadyForOpponent();
}

export function playHumanMove(args: {
  from: string;
  to: string;
  promotion?: PieceSymbol;
}): { ok: false } | { ok: true; fenBefore: string; node: GameNode } {
  const store = useGameStore.getState();
  const fenBefore = getCurrentNode(store.tree).fen;
  if (store.session.mode === "loading") {
    store.setMode("playerTurn");
  }
  const ok = store.playMove(
    {
      from: args.from,
      to: args.to,
      promotion: args.promotion,
    },
    { afterMode: "analyzing" },
  );
  if (!ok) return { ok: false };
  return {
    ok: true,
    fenBefore,
    node: getCurrentNode(useGameStore.getState().tree),
  };
}

export type TrySuggestedResult =
  | { ok: false; message: string }
  | {
      ok: true;
      tree: GameTree;
      mode: SessionMode;
      needsOpponent: boolean;
      message: string;
    };

export function trySuggestedMove(args: {
  tree: GameTree;
  insight: TeachingInsight | null;
  evidence: MoveAnalysisEvidence | null;
}): TrySuggestedResult {
  if (!args.insight?.suggestedMoveUci || !args.evidence) {
    return { ok: false, message: "Could not play that try-instead move" };
  }

  const analyzed = getNode(args.tree, args.evidence.gameNodeId);
  const originId = analyzed?.parentId ?? args.tree.rootId;
  const played = commitTryInstead({
    tree: args.tree,
    originNodeId: originId,
    lineUci: args.insight.lineUci,
    suggestedMoveUci: args.insight.suggestedMoveUci,
  });
  if (!played) {
    return { ok: false, message: "Could not play that try-instead move" };
  }

  const humanColor = useGameStore.getState().humanColor;
  const status = getStatusAtNode(played.tree, played.tree.currentNodeId);
  const mode: SessionMode = status.isGameOver
    ? "gameOver"
    : sessionModeForTurn(status.turn, humanColor);
  return {
    ok: true,
    tree: played.tree,
    mode,
    needsOpponent: !status.isGameOver && !isHumanTurn(status.turn, humanColor),
    message: `Trying ${played.node.move?.san ?? "alternate"} instead — prior line kept as a branch`,
  };
}

export function undoHumanMove(): void {
  const store = useGameStore.getState();
  const history = getMoveHistory(store.tree, store.tree.currentNodeId);
  let lastHumanIndex = -1;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.color === store.humanColor) {
      lastHumanIndex = i;
      break;
    }
  }
  if (lastHumanIndex < 0) return;
  const pliesToUndo = history.length - lastHumanIndex;
  for (let i = 0; i < pliesToUndo; i += 1) {
    store.retryMove();
  }
}
