import { styleBoardAnnotations } from "@/components/board/annotation-style";
import { lastMoveSquares } from "@/components/board/move-utils";
import type { SettingsEngineStatus } from "@/components/game/settings-sheet";
import {
  buildBranchGraph,
  isVirtualTimelineId,
  resolveReviewFen,
  type TimelineGraph,
} from "@/components/timeline/branch-graph";
import {
  findKingSquare,
  type GameSession,
  type GameTree,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  getTurn,
  HUMAN_COLOR,
  isHumanTurn,
  type SessionMode,
} from "@/domain/game";
import type {
  FeedbackNotice,
  HintStep,
  TeachingInsight,
} from "@/domain/teaching";
import { buildTutorLine } from "@/features/game/game-flow";
import type { GameStorePreferences } from "@/features/game/game-store";
import { buildFeedbackNotices } from "@/features/game/notices";
import {
  getStatusPresentation,
  type StatusPresentation,
  type StatusPresentationInput,
} from "@/features/game/status-copy";
import type { GameRuntime } from "@/features/game/use-game-runtime";
import type { ShellChrome } from "@/features/game/use-shell-ui";

export type ShellView = {
  hydrated: boolean;
  resumed: boolean;
  boardSize: number;
  compact: boolean;
  mascotBelow: boolean;
  boardLeft: number;
  liveFen: string;
  statusInput: StatusPresentationInput;
  status: StatusPresentation;
  badgeMode: SessionMode;
  maiaPhase: GameRuntime["maia"]["phase"];
  board: {
    fen: string;
    interactive: boolean;
    lastMove: { from: string; to: string } | null;
    isCheck: boolean;
    checkSquare: string | null;
    highlightSquares: string[];
    labels: Array<{ square: string; text: string }>;
    arrows: Array<{ from: string; to: string; color?: string }>;
  };
  isViewingNonLive: boolean;
  notices: FeedbackNotice[];
  coach: {
    expanded: boolean;
    insight: TeachingInsight | null;
    analyzing: boolean;
    canUndoHumanMove: boolean;
    showTrySuggested: boolean;
    hint: HintStep | null;
    evidenceGameNodeId: string | undefined;
    hintDisabled: boolean;
    hintFen: string;
    showTutorLaneHint: boolean;
  };
  timeline: {
    tree: GameTree;
    graph: TimelineGraph;
    reviewNodeId: string | null;
    previewNodeId: string | null;
    disabled: boolean;
    compact: boolean;
    expandedOverflowKeys: string[];
  };
  settings: {
    maiaElo: number;
    fen: string;
    canPlayMove: boolean;
    engine: Omit<SettingsEngineStatus, "onRetry">;
    canResign: boolean;
  };
  promotion: {
    open: boolean;
    from: string;
    to: string;
  };
};

export function buildShellView(args: {
  tree: GameTree;
  session: GameSession["session"];
  preferences: GameStorePreferences;
  hydrated: boolean;
  resumed: boolean;
  lastError: string | null;
  boardSize: number;
  compact: boolean;
  mascotBelow: boolean;
  boardLeft: number;
  runtime: GameRuntime;
  ui: ShellChrome;
}): ShellView {
  const { tree, session, runtime, ui } = args;
  const liveFen = getCurrentNode(tree).fen;
  const currentStatus = getStatusAtNode(tree, tree.currentNodeId);
  const moves = getMoveHistory(tree, tree.currentNodeId);
  const lastMove = moves[moves.length - 1] ?? null;
  const mode = session.mode;
  const isReviewing =
    ui.reviewNodeId != null && ui.reviewNodeId !== tree.currentNodeId;
  const viewedNodeId = ui.previewNodeId ?? ui.reviewNodeId;
  const isViewingNonLive =
    viewedNodeId != null && viewedNodeId !== tree.currentNodeId;

  const tutorLine = buildTutorLine(
    tree,
    runtime.coaching.insight,
    runtime.coaching.evidence,
  );
  const liveTurn = getTurn(liveFen);
  const futureLine =
    isHumanTurn(liveTurn) &&
    !isReviewing &&
    runtime.coaching.futureNodeId === tree.currentNodeId
      ? runtime.coaching.futureLine
      : null;

  const graph = buildBranchGraph({
    tree,
    reviewNodeId: ui.reviewNodeId,
    futureLine,
    tutorLine,
    expandedOverflowKeys: ui.expandedOverflowKeys,
    maxLaneSide: args.compact ? 1 : 2,
    showEngineLine: args.compact ? !tutorLine : isHumanTurn(liveTurn),
    showCoachLine: Boolean(tutorLine),
  });

  const boardFen = resolveReviewFen(tree, graph, viewedNodeId);
  const boardStatus =
    viewedNodeId && !isVirtualTimelineId(viewedNodeId)
      ? getStatusAtNode(tree, viewedNodeId)
      : getStatusAtNode(tree, tree.currentNodeId);

  const interactive =
    mode === "playerTurn" &&
    isHumanTurn(getTurn(liveFen)) &&
    !isViewingNonLive &&
    runtime.maia.phase !== "failed";

  const checkSquare =
    boardStatus.isCheck && !boardStatus.isGameOver
      ? findKingSquare(boardFen, boardStatus.turn)
      : null;

  const analyzing =
    runtime.coaching.phase === "analyzing" || mode === "analyzing";
  const visibleInsight = runtime.coaching.insightDismissed
    ? null
    : runtime.coaching.insight;
  const coachExpanded = ui.coachExpanded;

  const showCoachAnnotations =
    !isViewingNonLive &&
    !runtime.coachUnavailable &&
    (coachExpanded || Boolean(runtime.coaching.hint));

  const badgeMode: SessionMode = isReviewing ? "reviewing" : mode;
  const statusInput: StatusPresentationInput = {
    mode: badgeMode,
    status: currentStatus,
    terminalReason: session.terminalReason,
    maia: runtime.maia,
    lastError: args.lastError,
    coachUnavailable: runtime.coachUnavailable,
    coachMessage: runtime.coaching.message,
    lastMove,
    navigationMessage: ui.navMessage,
    enginesWarming: runtime.enginesWarming,
  };
  const status = getStatusPresentation(statusInput);

  const canResign =
    mode === "playerTurn" ||
    mode === "opponentThinking" ||
    mode === "analyzing" ||
    mode === "reviewing";
  const canUndoHumanMove =
    moves.some((m) => m.color === HUMAN_COLOR) &&
    (mode === "playerTurn" ||
      mode === "analyzing" ||
      mode === "reviewing" ||
      mode === "opponentThinking" ||
      mode === "gameOver");

  const boardMarks =
    isViewingNonLive || !showCoachAnnotations
      ? styleBoardAnnotations({
          highlightSquares: [],
          arrows: [],
          labels: [],
        })
      : styleBoardAnnotations(runtime.coaching.annotations);

  const viewedGraphNode = graph.nodes.find(
    (n) => n.id === (viewedNodeId ?? tree.currentNodeId),
  );
  const viewedTreeNode = getNode(tree, viewedNodeId ?? tree.currentNodeId);
  const boardLastMove = lastMoveSquares(
    viewedGraphNode?.uciFromParent ?? viewedTreeNode?.move?.uci ?? null,
  );

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

  return {
    hydrated: args.hydrated,
    resumed: args.resumed,
    boardSize: args.boardSize,
    compact: args.compact,
    mascotBelow: args.mascotBelow,
    boardLeft: args.boardLeft,
    liveFen,
    statusInput,
    status,
    badgeMode,
    maiaPhase: runtime.maia.phase,
    board: {
      fen: boardFen,
      interactive,
      lastMove: boardLastMove,
      isCheck: boardStatus.isCheck && !boardStatus.isGameOver,
      checkSquare,
      highlightSquares: boardMarks.highlightSquares,
      labels: boardMarks.labels,
      arrows: boardMarks.arrows,
    },
    isViewingNonLive,
    notices,
    coach: {
      expanded: coachExpanded,
      insight: visibleInsight,
      analyzing,
      canUndoHumanMove,
      showTrySuggested: Boolean(
        visibleInsight?.suggestedMoveUci && !runtime.coachUnavailable,
      ),
      hint: runtime.coaching.hint,
      evidenceGameNodeId: runtime.coaching.evidence?.gameNodeId,
      hintDisabled: !interactive || Boolean(runtime.coachUnavailable),
      hintFen: liveFen,
      showTutorLaneHint: Boolean(tutorLine),
    },
    timeline: {
      tree,
      graph,
      reviewNodeId: ui.reviewNodeId,
      previewNodeId: ui.previewNodeId,
      disabled: mode === "error",
      compact: args.compact,
      expandedOverflowKeys: ui.expandedOverflowKeys,
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
              : "Maia ready",
        starting: runtime.enginesWarming && runtime.maia.phase !== "failed",
        failed: runtime.maia.phase === "failed" || mode === "error",
        coachMessage:
          runtime.coachUnavailable ??
          (runtime.coaching.phase === "failed"
            ? runtime.coaching.message
            : null),
      },
      canResign,
    },
    promotion: {
      open: ui.promotion != null,
      from: ui.promotion?.from ?? "",
      to: ui.promotion?.to ?? "",
    },
  };
}
