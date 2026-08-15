import type { ProjectedLine } from "@/domain/analysis";
import { projectUciLine } from "@/domain/analysis";
import {
  type Color,
  type GameMove,
  type GameNode,
  type GameTree,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  isHumanTurn,
  type PieceSymbol,
  playMoveOnTree,
  type SessionMode,
  sessionModeForTurn,
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import type { CoachingController } from "@/features/game/coaching-controller";
import { useGameStore } from "@/features/game/game-store";
import type { MaiaSession } from "@/features/game/maia-session";

export function buildTutorLine(
  tree: GameTree,
  insight: TeachingInsight | null,
  analyzedNodeId: string | null,
): ProjectedLine | null {
  if (!insight?.lineUci.length || !analyzedNodeId) return null;
  if (!insight.suggestedMoveUci) return null;
  const analyzed = getNode(tree, analyzedNodeId);
  const playedUci = analyzed?.move?.uci.toLowerCase();
  const firstPly = insight.lineUci[0]?.toLowerCase();
  if (!firstPly || (playedUci && firstPly === playedUci)) return null;

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

export type TrySuggestedResult =
  | { ok: false; message: string }
  | {
      ok: true;
      tree: GameTree;
      mode: SessionMode;
      needsOpponent: boolean;
      message: string;
    };

export function firstHumanUciFromDraft(args: {
  draft: GameTree;
  originId: string;
  humanColor: Color;
}): string | null {
  const chain: Array<{ uci: string; color: Color }> = [];
  let cursor: string | null = args.draft.currentNodeId;
  const seen = new Set<string>();
  while (cursor && cursor !== args.originId && !seen.has(cursor)) {
    seen.add(cursor);
    const node = getNode(args.draft, cursor);
    if (!node?.move) break;
    chain.push({ uci: node.move.uci, color: node.move.color });
    cursor = node.parentId;
  }
  chain.reverse();
  return chain.find((move) => move.color === args.humanColor)?.uci ?? null;
}

export function commitPracticeMove(args: {
  liveTree: GameTree;
  originNodeId: string;
  commitUci: string;
}): TrySuggestedResult {
  const played = playMoveOnTree(
    args.liveTree,
    args.originNodeId,
    args.commitUci,
    {
      asVariation: false,
    },
  );
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
