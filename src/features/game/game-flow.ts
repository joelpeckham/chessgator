import type { ProjectedLine } from "@/domain/analysis";
import { projectUciLine } from "@/domain/analysis";
import {
  type GameMove,
  type GameNode,
  type GameTree,
  getCurrentNode,
  getNode,
  getStatusAtNode,
  type PieceSymbol,
  playMoveOnTree,
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import type { CoachingController } from "@/features/game/coaching-controller";
import { useGameStore } from "@/features/game/game-store";
import type { MaiaSession } from "@/features/game/maia-session";

export function buildSuggestedMove(
  tree: GameTree,
  insight: TeachingInsight | null,
  analyzedNodeId: string | null,
): ProjectedLine | null {
  if (!analyzedNodeId) return null;
  const uci = insight?.suggestedMoveUci ?? insight?.lineUci[0];
  if (!uci) return null;
  const analyzed = getNode(tree, analyzedNodeId);
  const playedUci = analyzed?.move?.uci.toLowerCase();
  if (playedUci && uci.toLowerCase() === playedUci) return null;

  const originId = analyzed?.parentId ?? tree.rootId;
  const origin = getNode(tree, originId);
  if (!origin) return null;
  const line = projectUciLine({
    rootFen: origin.fen,
    rootNodeId: originId,
    lineUci: [uci],
    maxPlies: 1,
  });
  return line.plies.length > 0 ? line : null;
}

function isLiveOpponentTurnAt(nodeId: string): boolean {
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
  onFailure?: (message: string) => void,
): void {
  if (maia.getState().phase !== "failed") return;
  const message = maia.getState().message ?? fallback;
  if (onFailure) {
    onFailure(message);
    return;
  }
  if (useGameStore.getState().session.mode !== "opponentThinking") return;
  useGameStore.getState().setMode("error", message);
}

export async function requestOpponentMove(args: {
  maia: MaiaSession;
  requestId: string;
  target?: { nodeId: string; fen: string };
  isCurrent?: (nodeId: string) => boolean;
  applyMove?: (uci: string) => boolean;
  onFailure?: (message: string) => void;
}): Promise<void> {
  const state = useGameStore.getState();
  const nodeId = args.target?.nodeId ?? state.tree.currentNodeId;
  const nodeFen = args.target?.fen ?? getCurrentNode(state.tree).fen;
  const isCurrent = args.isCurrent ?? isLiveOpponentTurnAt;

  if (!args.target && state.session.mode !== "opponentThinking") return;
  if (!isCurrent(nodeId)) return;

  const ready = await args.maia.whenReady();
  if (!ready) {
    surfaceOpponentEngineFailure(
      args.maia,
      args.maia.getState().message ?? "Maia failed to start",
      args.onFailure,
    );
    return;
  }
  if (!isCurrent(nodeId)) return;

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
      args.onFailure,
    );
    return;
  }
  if (!isCurrent(result.gameNodeId)) return;

  const apply =
    args.applyMove ?? ((uci: string) => useGameStore.getState().playMove(uci));
  const applied = apply(result.moveUci);
  if (!applied && !args.applyMove) {
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
  isCurrent?: () => boolean;
}): Promise<void> {
  const stillCurrent =
    args.isCurrent ??
    (() => {
      const latest = useGameStore.getState();
      return (
        latest.tree.currentNodeId === args.gameNodeId &&
        latest.session.mode === "analyzing"
      );
    });

  const node = getNode(useGameStore.getState().tree, args.gameNodeId);
  if (!node) return;
  if (!stillCurrent()) return;

  let analyzed = false;
  if (!args.coachUnavailable && args.coach.getState().phase !== "failed") {
    const evidence = await args.coach.analyzePlayerMove({
      requestId: args.requestId,
      gameNodeId: args.gameNodeId,
      fenBefore: args.fenBefore,
      fenAfter: node.fen,
      playedMove: args.playedMove,
      previousMove: node.parentId
        ? (getNode(useGameStore.getState().tree, node.parentId)?.move ?? null)
        : null,
    });
    analyzed = evidence != null;
  }

  if (!stillCurrent()) return;

  const insight = args.coach.getState().insight;
  if (insight && analyzed) {
    useGameStore.getState().setLesson(args.gameNodeId, insight);
  }

  if (!stillCurrent()) return;
  const latest = useGameStore.getState();
  if (latest.tree.currentNodeId !== args.gameNodeId) return;
  if (latest.session.mode !== "analyzing") return;
  const status = getStatusAtNode(latest.tree, args.gameNodeId);
  if (status.isGameOver) {
    latest.setMode("gameOver");
    return;
  }

  const current = getNode(latest.tree, args.gameNodeId);
  const replyId = current?.childIds.find(
    (id) => !latest.tree.nodes[id]?.isVariation,
  );
  if (replyId) {
    latest.goToNode(replyId);
    return;
  }

  latest.setMode("opponentThinking");
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

export type RealizeSuggestedResult =
  | { ok: false; message: string }
  | { ok: true; tree: GameTree; nodeId: string };

/** Play a single suggested UCI onto the live tree, reusing a matching child. */
export function realizeSuggestedMove(args: {
  tree: GameTree;
  originNodeId: string;
  uci: string;
}): RealizeSuggestedResult {
  if (!args.uci) {
    return { ok: false, message: "No suggested move to play" };
  }
  if (!getNode(args.tree, args.originNodeId)) {
    return { ok: false, message: "Could not play that suggested move" };
  }
  const played = playMoveOnTree(args.tree, args.originNodeId, args.uci);
  if (!played) {
    return { ok: false, message: "Could not play that suggested move" };
  }
  return { ok: true, tree: played.tree, nodeId: played.node.id };
}
