import { styleBoardAnnotations } from "@/components/board/annotation-style";
import { lastMoveSquares } from "@/components/board/move-utils";
import { isIdleHintEligible } from "@/components/coach/teaser-timing";
import type { SettingsEngineStatus } from "@/components/game/settings-sheet";
import {
  parseVirtualTimelineId,
  resolveReviewFen,
  virtualId,
} from "@/components/timeline/branch-graph-virtual";
import { transportStep } from "@/components/timeline/decision-graph-nav";
import type { EngineHintView } from "@/components/timeline/decision-types";
import {
  type Color,
  findKingSquare,
  type GameSession,
  type GameTree,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatus,
  getStatusAtNode,
  getTurn,
  isHumanTurn,
  type SessionMode,
} from "@/domain/game";
import {
  annotationsFromInsight,
  type FeedbackNotice,
  type HintStep,
  type TeachingInsight,
} from "@/domain/teaching";
import {
  buildTutorLine,
  firstHumanUciFromDraft,
} from "@/features/game/game-flow";
import type { GameStorePreferences } from "@/features/game/game-store";
import { buildFeedbackNotices } from "@/features/game/notices";
import {
  analyzedNodeIdForFocus,
  buildDecisionGraph,
  buildLessonFork,
  type DecisionGraph,
  decisionForCursor,
  lastHumanDecisionId,
  projectOpeningPlies,
  projectPlayerDecisions,
} from "@/features/game/player-decisions";
import {
  getStatusPresentation,
  type StatusPresentation,
  type StatusPresentationInput,
} from "@/features/game/status-copy";
import {
  graphCursorId,
  isReviewingNonLive,
  type TimelineSessionState,
  viewedNodeId,
} from "@/features/game/timeline-session";
import { deriveBoardInteractivity } from "@/features/game/turn-controller";
import type { GameRuntime } from "@/features/game/use-game-runtime";
import type { ShellChrome } from "@/features/game/use-shell-ui";

export type ShellView = {
  hydrated: boolean;
  resumed: boolean;
  boardSize: number;
  mascotBelow: boolean;
  boardLeft: number;
  liveFen: string;
  statusInput: StatusPresentationInput;
  status: StatusPresentation;
  badgeMode: SessionMode | "practicing";
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
  isViewingNonLive: boolean;
  isBoardPreview: boolean;
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
  };
  timeline: {
    graph: DecisionGraph;
    focusedDecisionId: string | null;
    focusedNodeId: string;
    liveNodeId: string;
    startNodeId: string;
    mode: TimelineSessionState["mode"];
    statusText: string;
    canGoPrev: boolean;
    canGoNext: boolean;
    canPracticeUndo: boolean;
    canPracticeRedo: boolean;
    canCommitPractice: boolean;
    canTakeBackLive: boolean;
    disabled: boolean;
    orientation: "white" | "black";
    prevNodeId: string | null;
    nextNodeId: string | null;
  };
  settings: {
    maiaElo: number;
    fen: string;
    canPlayMove: boolean;
    engine: Omit<SettingsEngineStatus, "onRetry">;
    canResign: boolean;
    pendingHumanColor: Color;
  };
  promotion: {
    open: boolean;
    from: string;
    to: string;
  };
};

function timelineStatusText(args: {
  mode: TimelineSessionState["mode"];
  practicePhase: TimelineSessionState["practicePhase"];
  originLabel: string | null;
  focusedLabel: string | null;
  livePly: number;
}): string {
  if (args.mode === "practice") {
    const from = args.originLabel
      ? `Practice from before ${args.originLabel}`
      : "Practice";
    if (args.practicePhase === "opponentThinking") {
      return `${from} · Maia replying`;
    }
    if (args.practicePhase === "gameOver") {
      return `${from} · line over`;
    }
    if (args.practicePhase === "error") {
      return `${from} · Maia failed`;
    }
    return `${from} · Your move`;
  }
  if (args.mode === "review") {
    return args.focusedLabel ? `Reviewing · ${args.focusedLabel}` : "Reviewing";
  }
  const move = Math.max(0, Math.floor((args.livePly + 1) / 2));
  return move === 0 ? "Live · start" : `Live · move ${move}`;
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
  runtime: GameRuntime;
  ui: ShellChrome;
}): ShellView {
  const { tree, session, humanColor, runtime, ui } = args;
  const liveFen = getCurrentNode(tree).fen;
  const currentStatus = getStatusAtNode(tree, tree.currentNodeId);
  const liveMoves = getMoveHistory(tree, tree.currentNodeId);
  const lastMove = liveMoves[liveMoves.length - 1] ?? null;
  const mode = session.mode;
  const timeline = ui.timeline;
  const draftTree =
    timeline.mode === "practice" && timeline.draftTree
      ? timeline.draftTree
      : null;
  const graphNodeId = graphCursorId(timeline, tree.currentNodeId);
  const boardNodeId = viewedNodeId(timeline, tree.currentNodeId);
  const isViewingNonLive = isReviewingNonLive(timeline, tree.currentNodeId);

  const virtual = parseVirtualTimelineId(graphNodeId);
  const tutorRootId =
    virtual?.kind === "tutor"
      ? virtual.rootNodeId
      : (timeline.practiceOriginId ?? null);
  const analyzedId = analyzedNodeIdForFocus({
    tree,
    focusNodeId: graphNodeId,
    tutorRootId,
    humanColor,
  });
  const storedLesson =
    (analyzedId ? (args.lessons[analyzedId] ?? null) : null) ??
    (timeline.expandedDecisionId
      ? (args.lessons[timeline.expandedDecisionId] ?? null)
      : null);
  const liveInsight = runtime.coaching.insightDismissed
    ? null
    : runtime.coaching.insight;
  const visibleInsight =
    timeline.mode === "review" || timeline.mode === "practice"
      ? storedLesson
      : (liveInsight ??
        (runtime.coaching.insightDismissed ? null : storedLesson));

  const tutorLine = buildTutorLine(tree, visibleInsight, analyzedId);
  const liveTurn = getTurn(liveFen);
  const futureLine =
    timeline.mode === "live" &&
    isHumanTurn(liveTurn, humanColor) &&
    runtime.coaching.futureNodeId === tree.currentNodeId
      ? runtime.coaching.futureLine
      : null;
  const engineHint: EngineHintView | null =
    futureLine?.plies[0] && timeline.mode === "live"
      ? {
          id: virtualId(
            "projected",
            futureLine.rootNodeId,
            futureLine.plies[0].pathKey,
          ),
          san: futureLine.plies[0].san,
          fen: futureLine.plies[0].fen,
        }
      : null;

  const liveDecisions = projectPlayerDecisions({
    tree,
    humanColor,
    lessons: args.lessons,
  });
  const focusedDecision = decisionForCursor({
    liveDecisions,
    cursorId: graphNodeId,
    liveTree: tree,
    humanColor,
    tutorRootId,
    practiceOriginId: timeline.practiceOriginId,
    expandedDecisionId: timeline.expandedDecisionId,
  });
  const lessonFork = focusedDecision
    ? buildLessonFork({
        tree,
        decision: focusedDecision,
        tutorLine,
        virtualId,
      })
    : null;
  const openingPlies = projectOpeningPlies(tree, humanColor);
  const graph = buildDecisionGraph({
    tree,
    startNodeId: tree.rootId,
    tipNodeId: tree.currentNodeId,
    openingPlies,
    decisions: liveDecisions,
    focusedDecision,
    lessonFork,
    engineHint: timeline.mode === "practice" ? null : engineHint,
    cursorId: graphNodeId,
    pinnedBranchId: timeline.pinnedBranchId,
    practice:
      draftTree && timeline.practiceOriginId
        ? {
            originId: timeline.practiceOriginId,
            draftTree,
            currentId: draftTree.currentNodeId,
          }
        : null,
  });

  const graphBoardNode = graph.nodes.find((node) => node.id === boardNodeId);
  const boardFen =
    graphBoardNode?.fen ||
    resolveReviewFen(draftTree ?? tree, boardNodeId, tutorLine, futureLine);
  const realBoardNode =
    getNode(draftTree ?? tree, boardNodeId) ?? getNode(tree, boardNodeId);
  const boardStatus = realBoardNode
    ? getStatusAtNode(draftTree ?? tree, realBoardNode.id)
    : getStatus(boardFen);

  const interactive = deriveBoardInteractivity({
    timelineMode: timeline.mode,
    practicePhase: timeline.practicePhase,
    draftTree,
    playCursorId: graphNodeId,
    liveMode: mode,
    liveFen,
    humanColor,
    isViewingNonLive,
    maiaFailed: runtime.maia.phase === "failed",
  });

  const checkSquare =
    boardStatus.isCheck && !boardStatus.isGameOver
      ? findKingSquare(boardFen, boardStatus.turn)
      : null;

  const analyzing =
    runtime.coaching.phase === "analyzing" || mode === "analyzing";
  const coachExpanded = ui.coachExpanded;

  const showCoachAnnotations =
    Boolean(visibleInsight) &&
    !runtime.coachUnavailable &&
    (coachExpanded || Boolean(runtime.coaching.hint) || isViewingNonLive);

  const badgeMode: SessionMode | "practicing" =
    timeline.mode === "practice"
      ? "practicing"
      : timeline.mode === "review"
        ? "reviewing"
        : mode;
  const statusInput: StatusPresentationInput = {
    mode: timeline.mode === "review" ? "reviewing" : mode,
    status:
      timeline.mode === "practice" && draftTree
        ? getStatusAtNode(draftTree, draftTree.currentNodeId)
        : currentStatus,
    terminalReason: session.terminalReason,
    maia: runtime.maia,
    lastError: args.lastError ?? timeline.practiceError,
    coachUnavailable: runtime.coachUnavailable,
    coachMessage: runtime.coaching.message,
    lastMove,
    navigationMessage: ui.navMessage,
    enginesWarming: runtime.enginesWarming,
    humanColor,
    timelineMode: timeline.mode,
    practicePhase: timeline.practicePhase,
  };
  const status = getStatusPresentation(statusInput);

  const canResign =
    mode === "playerTurn" ||
    mode === "opponentThinking" ||
    mode === "analyzing" ||
    mode === "reviewing";

  const lastHumanId = lastHumanDecisionId(tree, humanColor);
  const practiceAtLatestOrigin =
    timeline.mode === "practice" &&
    timeline.practiceOriginId ===
      (lastHumanId
        ? (getNode(tree, lastHumanId)?.parentId ?? tree.rootId)
        : null) &&
    timeline.draftTree?.currentNodeId === timeline.practiceOriginId;

  const boardMarks = showCoachAnnotations
    ? styleBoardAnnotations(
        annotationsFromInsight(
          visibleInsight,
          runtime.coaching.evidence,
          timeline.mode === "live" ? runtime.coaching.hint : null,
        ),
      )
    : styleBoardAnnotations({
        highlightSquares: [],
        arrows: [],
        labels: [],
      });

  const viewedTreeNode =
    getNode(draftTree ?? tree, boardNodeId) ?? getNode(tree, boardNodeId);
  const boardVirtual = parseVirtualTimelineId(boardNodeId);
  const previewTutorPly = boardVirtual
    ? (tutorLine?.plies.find(
        (ply) =>
          virtualId(boardVirtual.kind, boardVirtual.rootNodeId, ply.pathKey) ===
          boardNodeId,
      ) ??
      futureLine?.plies.find(
        (ply) =>
          virtualId(boardVirtual.kind, boardVirtual.rootNodeId, ply.pathKey) ===
          boardNodeId,
      ) ??
      null)
    : null;
  const boardLastMove = lastMoveSquares(
    viewedTreeNode?.move?.uci ?? previewTutorPly?.uci ?? null,
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

  const liveNode = getCurrentNode(tree);
  const graphCursorNode = graph.nodes.find((node) => node.id === graphNodeId);
  const focusedLabel =
    graphCursorNode?.moveLabel ||
    focusedDecision?.moveLabel ||
    (virtual ? (tutorLine?.plies[0]?.san ?? null) : null);
  const originLabel = focusedDecision?.moveLabel ?? null;

  const draftHumanUci =
    timeline.mode === "practice" &&
    timeline.draftTree &&
    timeline.practiceOriginId
      ? firstHumanUciFromDraft({
          draft: timeline.draftTree,
          originId: timeline.practiceOriginId,
          humanColor,
        })
      : null;
  const prevNodeId = transportStep(
    graph,
    graphNodeId,
    -1,
    timeline.pinnedBranchId,
  );
  const nextNodeId = transportStep(
    graph,
    graphNodeId,
    1,
    timeline.pinnedBranchId,
  );

  return {
    hydrated: args.hydrated,
    resumed: args.resumed,
    boardSize: args.boardSize,
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
      orientation: humanColor === "b" ? "black" : "white",
      lastMove: boardLastMove,
      isCheck: boardStatus.isCheck && !boardStatus.isGameOver,
      checkSquare,
      highlightSquares: boardMarks.highlightSquares,
      labels: boardMarks.labels,
      arrows: boardMarks.arrows,
    },
    isViewingNonLive,
    isBoardPreview: boardNodeId !== graphNodeId,
    notices,
    coach: {
      expanded: coachExpanded,
      insight: visibleInsight,
      analyzing,
      showTrySuggested: Boolean(
        visibleInsight &&
          !runtime.coachUnavailable &&
          timeline.mode !== "practice",
      ),
      hint: timeline.mode === "live" ? runtime.coaching.hint : null,
      evidenceGameNodeId: analyzedId ?? runtime.coaching.evidence?.gameNodeId,
      hintDisabled:
        !interactive ||
        Boolean(runtime.coachUnavailable) ||
        timeline.mode !== "live",
      hintFen: liveFen,
      showTutorLaneHint: Boolean(tutorLine),
      idleHintEligible: isIdleHintEligible({
        firstHumanTurn: !liveMoves.some((m) => m.color === humanColor),
        playerTurn: interactive && timeline.mode === "live",
        hasInsight: Boolean(visibleInsight),
        hasHint: Boolean(runtime.coaching.hint),
      }),
    },
    timeline: {
      graph,
      focusedDecisionId: focusedDecision?.id ?? null,
      focusedNodeId: graphNodeId,
      liveNodeId: tree.currentNodeId,
      startNodeId: tree.rootId,
      mode: timeline.mode,
      statusText: timelineStatusText({
        mode: timeline.mode,
        practicePhase: timeline.practicePhase,
        originLabel,
        focusedLabel,
        livePly: liveNode.ply,
      }),
      canGoPrev: prevNodeId != null,
      canGoNext: nextNodeId != null,
      canPracticeUndo:
        timeline.mode === "practice" &&
        Boolean(timeline.draftTree) &&
        (timeline.draftTree!.currentNodeId !== timeline.practiceOriginId ||
          timeline.practicePhase === "opponentThinking"),
      canPracticeRedo:
        timeline.mode === "practice" && timeline.practiceRedo.length > 0,
      canCommitPractice: timeline.mode === "practice" && Boolean(draftHumanUci),
      canTakeBackLive: practiceAtLatestOrigin,
      disabled: mode === "error" || timeline.practicePhase === "error",
      orientation: humanColor === "b" ? "black" : "white",
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
      pendingHumanColor: ui.pendingHumanColor,
    },
    promotion: {
      open: ui.promotion != null,
      from: ui.promotion?.from ?? "",
      to: ui.promotion?.to ?? "",
    },
  };
}
