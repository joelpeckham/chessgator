import { styleBoardAnnotations } from "@/components/board/annotation-style";
import { lastMoveSquares } from "@/components/board/move-utils";
import {
  type GatorMood,
  gameOverMood,
} from "@/components/coach/gator-expression";
import { isIdleHintEligible } from "@/components/coach/teaser-timing";
import type { SettingsEngineStatus } from "@/components/game/settings-sheet";
import type { DecisionGraph } from "@/components/timeline/decision-types";
import { transportStep } from "@/components/timeline/tree-nav";
import {
  type Color,
  findKingSquare,
  type GameSession,
  type GameTree,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  getTurn,
  isHumanTurn,
  movesToPgn,
  type SessionMode,
} from "@/domain/game";
import {
  annotationsFromInsight,
  type FeedbackNotice,
  type HintStep,
  type TeachingInsight,
} from "@/domain/teaching";
import { buildTutorLine } from "@/features/game/game-flow";
import type { GameStorePreferences } from "@/features/game/game-store";
import { buildFeedbackNotices } from "@/features/game/notices";
import {
  getStatusPresentation,
  type StatusPresentation,
} from "@/features/game/status-copy";
import {
  analyzedNodeIdForFocus,
  buildTreeGraph,
  formatMoveLabel,
  lastHumanDecisionId,
} from "@/features/game/tree-graph";
import { deriveBoardInteractivity } from "@/features/game/turn-controller";
import type { GameRuntime } from "@/features/game/use-game-runtime";
import type { ShellChrome } from "@/features/game/use-shell-ui";

export type ShellView = {
  hydrated: boolean;
  resumed: boolean;
  boardSize: number;
  mascotBelow: boolean;
  boardLeft: number;
  coachDocked: boolean;
  coachLaneLeft: number;
  stubMode: boolean;
  liveFen: string;
  status: StatusPresentation;
  badgeMode: SessionMode;
  maiaPhase: GameRuntime["maia"]["phase"];
  board: {
    fen: string;
    interactive: boolean;
    orientation: "white" | "black";
    lastMove: { from: string; to: string } | null;
    isCheck: boolean;
    checkSquare: string | null;
    highlightSquares: string[];
    labels: Array<{ square: string; text: string }>;
    arrows: Array<{ from: string; to: string; color?: string }>;
  };
  notices: FeedbackNotice[];
  coach: {
    expanded: boolean;
    insight: TeachingInsight | null;
    analyzing: boolean;
    showTrySuggested: boolean;
    hint: HintStep | null;
    evidenceGameNodeId: string | undefined;
    hintDisabled: boolean;
    hintFen: string;
    showTutorLaneHint: boolean;
    idleHintEligible: boolean;
    orientationTeaser: string | null;
    mood: GatorMood | null;
  };
  gameOver: {
    visible: boolean;
    headline: string;
    detail: string | null;
    mood: GatorMood;
    pgn: string;
  };
  timeline: {
    graph: DecisionGraph;
    focusedNodeId: string;
    startNodeId: string;
    statusText: string;
    canGoPrev: boolean;
    canGoNext: boolean;
    canTakeBack: boolean;
    disabled: boolean;
    prevNodeId: string | null;
    nextNodeId: string | null;
  };
  settings: {
    maiaElo: number;
    fen: string;
    canPlayMove: boolean;
    engine: Omit<SettingsEngineStatus, "onRetry">;
    canResign: boolean;
    confirmRestart: boolean;
    pgn: string;
    pendingHumanColor: Color;
  };
  promotion: {
    open: boolean;
    from: string;
    to: string;
  };
};

function timelineStatusText(args: {
  focusedLabel: string | null;
  ply: number;
}): string {
  if (args.ply === 0) return "Start";
  return (
    args.focusedLabel ?? `Move ${Math.max(0, Math.floor((args.ply + 1) / 2))}`
  );
}

export function buildShellView(args: {
  tree: GameTree;
  session: GameSession["session"];
  humanColor: Color;
  preferences: GameStorePreferences;
  lessons: Readonly<Record<string, TeachingInsight>>;
  hydrated: boolean;
  resumed: boolean;
  lastError: string | null;
  boardSize: number;
  mascotBelow: boolean;
  boardLeft: number;
  coachDocked: boolean;
  coachLaneLeft: number;
  stubMode: boolean;
  runtime: GameRuntime;
  ui: ShellChrome;
}): ShellView {
  const { tree, session, humanColor, runtime, ui } = args;
  const currentNode = getCurrentNode(tree);
  const liveFen = currentNode.fen;
  const currentStatus = getStatusAtNode(tree, tree.currentNodeId);
  const liveMoves = getMoveHistory(tree, tree.currentNodeId);
  const lastMove = liveMoves[liveMoves.length - 1] ?? null;
  const mode = session.mode;

  const analyzedId = analyzedNodeIdForFocus({
    tree,
    focusNodeId: tree.currentNodeId,
    humanColor,
  });
  const storedLesson = analyzedId ? (args.lessons[analyzedId] ?? null) : null;
  const liveInsight = runtime.coaching.insightDismissed
    ? null
    : runtime.coaching.insight;
  const liveMatchesCurrent =
    liveInsight != null &&
    (runtime.coaching.evidence?.gameNodeId == null ||
      runtime.coaching.evidence.gameNodeId === analyzedId);
  const visibleInsight = liveMatchesCurrent ? liveInsight : storedLesson;

  const tutorLine = buildTutorLine(tree, visibleInsight, analyzedId);
  const liveTurn = getTurn(liveFen);
  const futureLine =
    isHumanTurn(liveTurn, humanColor) &&
    runtime.coaching.futureNodeId === tree.currentNodeId
      ? runtime.coaching.futureLine
      : null;

  const graph = buildTreeGraph({
    tree,
    lessons: args.lessons,
    tutorLine,
    futureLine,
  });

  const interactive = deriveBoardInteractivity({
    liveMode: mode,
    liveFen,
    humanColor,
    maiaFailed: runtime.maia.phase === "failed",
  });

  const checkSquare =
    currentStatus.isCheck && !currentStatus.isGameOver
      ? findKingSquare(liveFen, currentStatus.turn)
      : null;

  const analyzing =
    runtime.coaching.phase === "analyzing" || mode === "analyzing";
  const coachExpanded = ui.coachExpanded || args.coachDocked;

  const showCoachAnnotations =
    Boolean(visibleInsight) &&
    !runtime.coachUnavailable &&
    (coachExpanded || Boolean(runtime.coaching.hint));

  const status = getStatusPresentation({
    mode,
    status: currentStatus,
    terminalReason: session.terminalReason,
    maia: runtime.maia,
    lastError: args.lastError,
    coachUnavailable: runtime.coachUnavailable,
    coachMessage: runtime.coaching.message,
    lastMove,
    navigationMessage: ui.navMessage,
    enginesWarming: runtime.enginesWarming,
    humanColor,
  });

  const canResign =
    mode === "playerTurn" ||
    mode === "opponentThinking" ||
    mode === "analyzing" ||
    mode === "reviewing";

  const boardMarks = showCoachAnnotations
    ? styleBoardAnnotations(
        annotationsFromInsight(
          visibleInsight,
          runtime.coaching.evidence,
          runtime.coaching.hint,
        ),
      )
    : styleBoardAnnotations({
        highlightSquares: [],
        arrows: [],
        labels: [],
      });

  const notices = buildFeedbackNotices({
    engineNoticeArmed: runtime.engineNoticeArmed,
    enginesWarming: runtime.enginesWarming,
    dismissedIds: ui.dismissedNotices,
    maiaPhase: runtime.maia.phase,
    maiaMessage: runtime.maia.message,
    mode,
    errorHeadline: status.headline,
    errorDetail: status.detail,
    navMessage: ui.navMessage,
  });

  const graphCursorNode = graph.nodes.find(
    (node) => node.id === tree.currentNodeId,
  );
  const focusedLabel =
    graphCursorNode?.moveLabel ||
    formatMoveLabel(currentNode.ply, currentNode.move?.san ?? null);

  const prevNodeId = transportStep(graph, tree.currentNodeId, -1);
  const nextNodeId = transportStep(graph, tree.currentNodeId, 1);

  const firstHumanTurn = !liveMoves.some((m) => m.color === humanColor);
  const orientationTeaser =
    !args.resumed && firstHumanTurn && mode !== "gameOver"
      ? `You're ${humanColor === "b" ? "Black" : "White"} — make a move. I'll coach you after each one.`
      : null;
  const overMood = gameOverMood({
    result: currentStatus.result,
    terminalReason: session.terminalReason,
    humanColor,
  });
  const rootFen = getNode(tree, tree.rootId)?.fen ?? liveFen;
  const pgnResult =
    session.terminalReason === "resignation"
      ? humanColor === "w"
        ? "blackWins"
        : "whiteWins"
      : currentStatus.result;
  const pgn = movesToPgn({
    rootFen,
    moves: liveMoves,
    result: pgnResult,
  });
  const coachMood: GatorMood | null = mode === "gameOver" ? overMood : null;

  return {
    hydrated: args.hydrated,
    resumed: args.resumed,
    boardSize: args.boardSize,
    mascotBelow: args.mascotBelow,
    boardLeft: args.boardLeft,
    coachDocked: args.coachDocked,
    coachLaneLeft: args.coachLaneLeft,
    stubMode: args.stubMode,
    liveFen,
    status,
    badgeMode: mode,
    maiaPhase: runtime.maia.phase,
    board: {
      fen: liveFen,
      interactive,
      orientation: humanColor === "b" ? "black" : "white",
      lastMove: lastMoveSquares(currentNode.move?.uci ?? null),
      isCheck: currentStatus.isCheck && !currentStatus.isGameOver,
      checkSquare,
      highlightSquares: boardMarks.highlightSquares,
      labels: boardMarks.labels,
      arrows: boardMarks.arrows,
    },
    notices,
    coach: {
      expanded: coachExpanded,
      insight: visibleInsight,
      analyzing,
      showTrySuggested: Boolean(
        visibleInsight && !runtime.coachUnavailable && tutorLine,
      ),
      hint: runtime.coaching.hint,
      evidenceGameNodeId: analyzedId ?? runtime.coaching.evidence?.gameNodeId,
      hintDisabled: !interactive || Boolean(runtime.coachUnavailable),
      hintFen: liveFen,
      showTutorLaneHint: Boolean(tutorLine),
      idleHintEligible: isIdleHintEligible({
        firstHumanTurn,
        playerTurn: interactive,
        hasInsight: Boolean(visibleInsight),
        hasHint: Boolean(runtime.coaching.hint),
      }),
      orientationTeaser,
      mood: coachMood,
    },
    gameOver: {
      visible: mode === "gameOver" && !ui.gameOverDismissed,
      headline: status.headline,
      detail: status.detail,
      mood: overMood,
      pgn,
    },
    timeline: {
      graph,
      focusedNodeId: tree.currentNodeId,
      startNodeId: tree.rootId,
      statusText: timelineStatusText({
        focusedLabel,
        ply: currentNode.ply,
      }),
      canGoPrev: prevNodeId != null,
      canGoNext: nextNodeId != null,
      canTakeBack: lastHumanDecisionId(tree, humanColor) != null,
      disabled: mode === "error",
      prevNodeId,
      nextNodeId,
    },
    settings: {
      maiaElo: args.preferences.maiaElo,
      fen: liveFen,
      canPlayMove: interactive,
      engine: {
        message:
          runtime.maia.phase === "failed"
            ? runtime.maia.message
            : runtime.enginesWarming
              ? (runtime.maia.message ?? "Starting engines…")
              : runtime.coachUnavailable
                ? "Maia ready"
                : "Maia ready · Coach ready",
        starting: runtime.enginesWarming && runtime.maia.phase !== "failed",
        failed: runtime.maia.phase === "failed" || mode === "error",
        coachMessage:
          runtime.coachUnavailable ??
          (runtime.coaching.phase === "failed"
            ? runtime.coaching.message
            : null),
      },
      canResign,
      confirmRestart: liveMoves.length > 0 && mode !== "gameOver",
      pgn,
      pendingHumanColor: ui.pendingHumanColor,
    },
    promotion: {
      open: ui.promotion != null,
      from: ui.promotion?.from ?? "",
      to: ui.promotion?.to ?? "",
    },
  };
}
