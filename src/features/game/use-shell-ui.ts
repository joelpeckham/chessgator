"use client";

import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { BoardMove } from "@/components/board/move-utils";
import { parseVirtualTimelineId } from "@/components/timeline/branch-graph-virtual";
import {
  type Color,
  type GameMove,
  getCurrentNode,
  getNode,
} from "@/domain/game";
import {
  commitPracticeMove,
  firstHumanUciFromDraft,
  playHumanMove,
  requestOpponentMove,
  runPostMoveCoaching,
  undoHumanMove,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import {
  analyzedNodeIdForFocus,
  lastHumanDecisionId,
} from "@/features/game/player-decisions";
import {
  graphCursorId,
  INITIAL_TIMELINE_SESSION,
  reduceTimelineSession,
  type TimelineSessionState,
  viewedNodeId,
} from "@/features/game/timeline-session";
import {
  deriveBoardInteractivity,
  deriveOpponentTarget,
  opponentTargetKey,
} from "@/features/game/turn-controller";
import type { GameRuntime } from "@/features/game/use-game-runtime";

export type ShellChrome = {
  timeline: TimelineSessionState;
  promotion: { from: string; to: string } | null;
  settingsOpen: boolean;
  coachExpanded: boolean;
  navMessage: string | null;
  dismissedNotices: ReadonlySet<string>;
  pendingHumanColor: Color;
  gameOverDismissed: boolean;
};

export type TimelineNodeMeta = {
  branchId: string;
  decisionId: string | null;
};

export type ShellUi = ShellChrome & {
  queueNav: (message: string | null) => void;
  setPreviewNodeId: (id: string | null) => void;
  setPromotion: (value: { from: string; to: string } | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setCoachExpanded: (expanded: boolean) => void;
  dismissNotice: (id: string) => void;
  applyPlayerMove: (move: BoardMove | GameMove) => boolean;
  handleTrySuggested: () => void;
  handleUndoHumanMove: () => void;
  handleResign: () => void;
  handleRestart: () => void;
  setPendingHumanColor: (color: Color) => void;
  handleRetryEngines: () => Promise<void>;
  handleSelectTimelineNode: (nodeId: string, meta?: TimelineNodeMeta) => void;
  handleSelectDecision: (decisionId: string, meta?: TimelineNodeMeta) => void;
  handleReturnLive: () => void;
  handleCoachExpandedChange: (next: boolean) => void;
  handleDismissCoach: () => void;
  handleRequestHint: () => void;
  handleOpenCoach: () => void;
  handleSettingsOpenChange: (open: boolean) => void;
  handlePracticeUndo: () => void;
  handlePracticeRedo: () => void;
  handleCommitPractice: () => void;
  handleCancelPractice: () => void;
  dismissGameOver: () => void;
};

export function useShellUi(runtime: GameRuntime): ShellUi {
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeline, dispatchTimeline] = useReducer(
    reduceTimelineSession,
    INITIAL_TIMELINE_SESSION,
  );
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [navMessage, setNavMessage] = useState<string | null>(null);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingHumanColor, setPendingHumanColor] = useState<Color>(
    () => useGameStore.getState().humanColor,
  );
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const [schedulerNonce, setSchedulerNonce] = useState(0);

  const startGame = useGameStore((s) => s.startGame);
  const resumePlay = useGameStore((s) => s.resumePlay);
  const resign = useGameStore((s) => s.resign);
  const replaceTree = useGameStore((s) => s.replaceTree);
  const setMode = useGameStore((s) => s.setMode);
  const hydrated = useGameStore((s) => s.hydrated);
  const liveMode = useGameStore((s) => s.session.mode);
  const liveCurrentId = useGameStore((s) => s.tree.currentNodeId);

  const requestSeq = useRef(0);
  const bootstrappedRef = useRef(false);
  const flowGen = useRef(0);
  const timelineRef = useRef(timeline);

  useLayoutEffect(() => {
    timelineRef.current = timeline;
  });

  function nextRequestId(prefix: string): string {
    requestSeq.current += 1;
    return `${prefix}-${requestSeq.current}`;
  }

  function queueNav(message: string | null): void {
    window.setTimeout(() => setNavMessage(message), 0);
  }

  function bumpScheduler(): void {
    flowGen.current += 1;
    setSchedulerNonce((n) => n + 1);
  }

  function resetPending(options?: { clearCoach?: boolean }): void {
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    bumpScheduler();
    if (options?.clearCoach) {
      runtime.coach.clearFeedback();
    }
    dispatchTimeline({ type: "reset" });
    setCoachExpanded(false);
  }

  const opponentTarget = deriveOpponentTarget({
    timelineMode: timeline.mode,
    practicePhase: timeline.practicePhase,
    draftTree: timeline.draftTree,
    liveMode,
    liveTree: useGameStore.getState().tree,
  });
  const targetKey = opponentTargetKey(opponentTarget);

  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const state = useGameStore.getState();
    if (state.resumed && state.session.mode === "reviewing") {
      resumePlay();
      queueNav("Resumed local game");
      return;
    }
    if (state.resumed && state.session.mode === "gameOver") {
      queueNav("Loaded finished game");
      return;
    }
    if (state.session.mode === "loading" || !state.resumed) {
      const hydrateError = state.lastError;
      startGame();
      if (hydrateError) {
        queueNav(hydrateError);
      }
    }
    // Bootstrap once after hydrate; startGame/resumePlay are stable store actions.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!targetKey || !opponentTarget) return;
    const captured = opponentTarget;
    const requestId = nextRequestId("opp");
    void requestOpponentMove({
      maia: runtime.maiaSession,
      requestId,
      target: { nodeId: captured.nodeId, fen: captured.fen },
      isCurrent: (nodeId) => {
        const latest = deriveOpponentTarget({
          timelineMode: timelineRef.current.mode,
          practicePhase: timelineRef.current.practicePhase,
          draftTree: timelineRef.current.draftTree,
          liveMode: useGameStore.getState().session.mode,
          liveTree: useGameStore.getState().tree,
        });
        return latest?.scope === captured.scope && latest.nodeId === nodeId;
      },
      applyMove: (uci) => {
        if (captured.scope === "practice") {
          const session = timelineRef.current;
          if (
            session.mode !== "practice" ||
            session.practicePhase !== "opponentThinking"
          ) {
            return false;
          }
          if (session.draftTree?.currentNodeId !== captured.nodeId)
            return false;
          dispatchTimeline({ type: "practiceOpponentMove", input: uci });
          return true;
        }
        return useGameStore.getState().playMove(uci);
      },
      onFailure: (message) => {
        if (captured.scope === "practice") {
          dispatchTimeline({ type: "practiceError", message });
          return;
        }
        useGameStore.getState().setMode("error", message);
      },
    });
    return () => {
      runtime.maiaSession.cancelPending();
    };
    // liveCurrentId keeps the target in sync with the live pointer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, schedulerNonce, runtime.maiaSession, liveCurrentId]);

  function isBoardInteractive(): boolean {
    const { tree, session, humanColor } = useGameStore.getState();
    const liveFen = getCurrentNode(tree).fen;
    const viewed = viewedNodeId(timeline, tree.currentNodeId);
    return deriveBoardInteractivity({
      timelineMode: timeline.mode,
      practicePhase: timeline.practicePhase,
      draftTree: timeline.draftTree,
      playCursorId: graphCursorId(timeline, tree.currentNodeId),
      liveMode: session.mode,
      liveFen,
      humanColor,
      isViewingNonLive:
        viewed !== tree.currentNodeId && timeline.mode !== "practice",
      maiaFailed: runtime.maia.phase === "failed",
    });
  }

  function applyPlayerMove(move: BoardMove | GameMove): boolean {
    if (!isBoardInteractive()) return false;
    const humanColor = useGameStore.getState().humanColor;
    if (timeline.mode === "practice") {
      dispatchTimeline({
        type: "practiceMove",
        humanColor,
        input: {
          from: move.from,
          to: move.to,
          promotion: "promotion" in move ? move.promotion : undefined,
        },
      });
      setPromotion(null);
      return true;
    }
    const played = playHumanMove({
      from: move.from,
      to: move.to,
      promotion: "promotion" in move ? move.promotion : undefined,
    });
    if (!played.ok) return false;
    setPromotion(null);
    dispatchTimeline({ type: "reset" });
    setCoachExpanded(false);
    runtime.coach.resetHints();

    if (!played.node.move) {
      useGameStore.getState().setMode("opponentThinking");
      return true;
    }

    const capturedGen = flowGen.current;
    const gameNodeId = played.node.id;
    void runPostMoveCoaching({
      coach: runtime.coach,
      fenBefore: played.fenBefore,
      gameNodeId,
      playedMove: played.node.move,
      coachUnavailable: runtime.coachUnavailable,
      requestId: nextRequestId("coach"),
      isCurrent: () => {
        if (flowGen.current !== capturedGen) return false;
        const latest = useGameStore.getState();
        return (
          latest.tree.currentNodeId === gameNodeId &&
          latest.session.mode === "analyzing"
        );
      },
    });
    return true;
  }

  function analyzedFocusId(): string | null {
    const { tree, humanColor } = useGameStore.getState();
    const current = viewedNodeId(timeline, tree.currentNodeId);
    const virtual = parseVirtualTimelineId(current);
    return analyzedNodeIdForFocus({
      tree,
      focusNodeId: current,
      tutorRootId: virtual?.kind === "tutor" ? virtual.rootNodeId : null,
      humanColor,
    });
  }

  function originForPractice(): string | null {
    const { tree } = useGameStore.getState();
    const analyzedId = analyzedFocusId();
    if (analyzedId) {
      return getNode(tree, analyzedId)?.parentId ?? tree.rootId;
    }
    const humanId = lastHumanDecisionId(
      tree,
      useGameStore.getState().humanColor,
    );
    if (!humanId) return null;
    return getNode(tree, humanId)?.parentId ?? tree.rootId;
  }

  function handleTrySuggested(): void {
    const originId = originForPractice();
    if (!originId) {
      queueNav("Could not start practice from here");
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    bumpScheduler();
    if (useGameStore.getState().session.mode === "analyzing") {
      resumePlay();
    }
    const expandedId = analyzedFocusId();
    dispatchTimeline({
      type: "startPractice",
      originId,
      liveTree: useGameStore.getState().tree,
      humanColor: useGameStore.getState().humanColor,
      expandedDecisionId: expandedId,
    });
    setCoachExpanded(false);
    queueNav("Practice this position — the live game is unchanged");
  }

  function handleUndoHumanMove(): void {
    resetPending({ clearCoach: true });
    undoHumanMove();
    queueNav("Undid your last move — try a different one");
  }

  function handleResign(): void {
    resetPending();
    setSettingsOpen(false);
    resign();
  }

  function handleRestart(): void {
    resetPending({ clearCoach: true });
    setGameOverDismissed(false);
    setSettingsOpen(false);
    useGameStore.setState({ resumed: false });
    startGame({ humanColor: pendingHumanColor });
    queueNav("New game started");
  }

  function dismissGameOver(): void {
    setGameOverDismissed(true);
  }

  async function handleRetryEngines(): Promise<void> {
    await runtime.retryEngines();
    bumpScheduler();
  }

  function handleSelectTimelineNode(
    nodeId: string,
    meta?: TimelineNodeMeta,
  ): void {
    const currentId = useGameStore.getState().tree.currentNodeId;
    dispatchTimeline({
      type: "selectNode",
      nodeId,
      liveId: currentId,
      pinnedBranchId: meta?.branchId,
      expandedDecisionId: meta?.decisionId,
    });
    const virtual = parseVirtualTimelineId(nodeId);
    if (virtual?.kind === "tutor") {
      setCoachExpanded(true);
    }
  }

  function handleSelectDecision(
    decisionId: string,
    meta?: TimelineNodeMeta,
  ): void {
    handleSelectTimelineNode(decisionId, meta);
    const lesson = useGameStore.getState().lessons[decisionId];
    if (lesson) setCoachExpanded(true);
  }

  function handleReturnLive(): void {
    dispatchTimeline({ type: "returnLive" });
  }

  function handleCoachExpandedChange(next: boolean): void {
    setCoachExpanded(next);
    if (next) {
      const analyzedId = analyzedFocusId();
      if (analyzedId) runtime.coach.showInsight(analyzedId);
    }
  }

  function handleDismissCoach(): void {
    runtime.coach.dismissInsight();
    setCoachExpanded(false);
    dispatchTimeline({ type: "returnLive" });
  }

  function handleRequestHint(): void {
    if (runtime.coachUnavailable) return;
    const tree = useGameStore.getState().tree;
    setCoachExpanded(true);
    runtime.coach.showInsight();
    void runtime.coach.escalateHint({
      fen: getCurrentNode(tree).fen,
      gameNodeId: tree.currentNodeId,
      sideToMove: useGameStore.getState().humanColor,
    });
  }

  function handleOpenCoach(): void {
    const analyzedId = analyzedFocusId();
    if (analyzedId) runtime.coach.showInsight(analyzedId);
    setCoachExpanded(true);
  }

  function handleSettingsOpenChange(open: boolean): void {
    setSettingsOpen(open);
    if (open) {
      setPendingHumanColor(useGameStore.getState().humanColor);
      setCoachExpanded(false);
    }
  }

  function handlePracticeUndo(): void {
    runtime.maiaSession.cancelPending();
    bumpScheduler();
    dispatchTimeline({ type: "practiceUndo" });
  }

  function handlePracticeRedo(): void {
    dispatchTimeline({
      type: "practiceRedo",
      humanColor: useGameStore.getState().humanColor,
    });
  }

  function handleCommitPractice(): void {
    const { tree, humanColor } = useGameStore.getState();
    if (timeline.mode !== "practice" || !timeline.draftTree) return;
    const originId = timeline.practiceOriginId ?? tree.rootId;
    const fromDraft = firstHumanUciFromDraft({
      draft: timeline.draftTree,
      originId,
      humanColor,
    });
    if (!fromDraft) {
      queueNav("Play a move first");
      return;
    }
    const result = commitPracticeMove({
      liveTree: tree,
      originNodeId: originId,
      commitUci: fromDraft,
    });
    if (!result.ok) {
      queueNav(result.message);
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.clearFeedback();
    bumpScheduler();
    replaceTree(result.tree);
    dispatchTimeline({ type: "reset" });
    setCoachExpanded(false);
    setMode(result.mode);
    queueNav(result.message);
  }

  function handleCancelPractice(): void {
    runtime.maiaSession.cancelPending();
    bumpScheduler();
    dispatchTimeline({ type: "cancelPractice" });
  }

  function dismissNotice(id: string): void {
    setDismissedNotices((prev) => new Set(prev).add(id));
    if (id === "nav") queueNav(null);
  }

  function setPreviewNodeId(id: string | null): void {
    dispatchTimeline({ type: "preview", nodeId: id });
  }

  return {
    timeline,
    promotion,
    settingsOpen,
    coachExpanded,
    navMessage,
    dismissedNotices,
    queueNav,
    setPreviewNodeId,
    setPromotion,
    setSettingsOpen,
    setCoachExpanded,
    dismissNotice,
    applyPlayerMove,
    handleTrySuggested,
    handleUndoHumanMove,
    handleResign,
    handleRestart,
    pendingHumanColor,
    gameOverDismissed,
    setPendingHumanColor,
    dismissGameOver,
    handleRetryEngines,
    handleSelectTimelineNode,
    handleSelectDecision,
    handleReturnLive,
    handleCoachExpandedChange,
    handleDismissCoach,
    handleRequestHint,
    handleOpenCoach,
    handleSettingsOpenChange,
    handlePracticeUndo,
    handlePracticeRedo,
    handleCommitPractice,
    handleCancelPractice,
  };
}
