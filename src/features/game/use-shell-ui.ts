"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardMove } from "@/components/board/move-utils";
import { parseVirtualTimelineId } from "@/components/timeline/virtual-id";
import { type Color, type GameMove, getCurrentNode } from "@/domain/game";
import {
  playHumanMove,
  realizeTutorLine,
  requestOpponentMove,
  runPostMoveCoaching,
  undoHumanMove,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import { analyzedNodeIdForFocus } from "@/features/game/tree-graph";
import {
  deriveBoardInteractivity,
  deriveOpponentTarget,
  opponentTargetKey,
} from "@/features/game/turn-controller";
import type { GameRuntime } from "@/features/game/use-game-runtime";

export type ShellChrome = {
  promotion: { from: string; to: string } | null;
  settingsOpen: boolean;
  coachExpanded: boolean;
  timelineExpanded: boolean;
  navMessage: string | null;
  dismissedNotices: ReadonlySet<string>;
  pendingHumanColor: Color;
  gameOverDismissed: boolean;
};

function analyzedFocusId(): string | null {
  const { tree, humanColor } = useGameStore.getState();
  return analyzedNodeIdForFocus({
    tree,
    focusNodeId: tree.currentNodeId,
    humanColor,
  });
}

export type ShellUi = ShellChrome & {
  queueNav: (message: string | null) => void;
  setPromotion: (value: { from: string; to: string } | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setCoachExpanded: (expanded: boolean) => void;
  setTimelineExpanded: (expanded: boolean) => void;
  dismissNotice: (id: string) => void;
  applyPlayerMove: (move: BoardMove | GameMove) => boolean;
  handleTrySuggested: () => void;
  handleUndoHumanMove: () => void;
  handleResign: () => void;
  handleRestart: () => void;
  setPendingHumanColor: (color: Color) => void;
  handleRetryEngines: () => Promise<void>;
  handleSelectTimelineNode: (nodeId: string) => void;
  handleCoachExpandedChange: (next: boolean) => void;
  handleDismissCoach: () => void;
  handleRequestHint: () => void;
  handleOpenCoach: () => void;
  handleSettingsOpenChange: (open: boolean) => void;
  dismissGameOver: () => void;
};

export function useShellUi(runtime: GameRuntime): ShellUi {
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
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
  const goToNode = useGameStore((s) => s.goToNode);
  const replaceTree = useGameStore((s) => s.replaceTree);
  const hydrated = useGameStore((s) => s.hydrated);
  const liveMode = useGameStore((s) => s.session.mode);
  const liveCurrentId = useGameStore((s) => s.tree.currentNodeId);

  const requestSeq = useRef(0);
  const bootstrappedRef = useRef(false);
  const flowGen = useRef(0);

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
    setCoachExpanded(false);
  }

  const opponentTarget = deriveOpponentTarget({
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
          liveMode: useGameStore.getState().session.mode,
          liveTree: useGameStore.getState().tree,
        });
        return latest?.nodeId === nodeId;
      },
      applyMove: (uci) => useGameStore.getState().playMove(uci),
      onFailure: (message) => {
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
    return deriveBoardInteractivity({
      liveMode: session.mode,
      liveFen: getCurrentNode(tree).fen,
      humanColor,
      maiaFailed: runtime.maia.phase === "failed",
    });
  }

  function applyPlayerMove(move: BoardMove | GameMove): boolean {
    if (!isBoardInteractive()) return false;
    const played = playHumanMove({
      from: move.from,
      to: move.to,
      promotion: "promotion" in move ? move.promotion : undefined,
    });
    if (!played.ok) return false;
    setPromotion(null);
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

  function applyRealizedTree(tree: ReturnType<typeof realizeTutorLine>): void {
    if (!tree.ok) {
      queueNav(tree.message);
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    bumpScheduler();
    replaceTree(tree.tree);
    goToNode(tree.nodeId);
    setCoachExpanded(true);
  }

  function handleTrySuggested(): void {
    const { tree, lessons } = useGameStore.getState();
    const analyzedId = analyzedFocusId();
    const insight = analyzedId ? (lessons[analyzedId] ?? null) : null;
    const firstUci = insight?.suggestedMoveUci ?? insight?.lineUci[0];
    if (!analyzedId || !firstUci) {
      queueNav("No suggested move to play");
      return;
    }
    const originId = tree.nodes[analyzedId]?.parentId ?? tree.rootId;
    applyRealizedTree(
      realizeTutorLine({
        tree,
        originNodeId: originId,
        uciPath: [firstUci],
      }),
    );
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

  function handleSelectTimelineNode(nodeId: string): void {
    const virtual = parseVirtualTimelineId(nodeId);
    if (virtual?.kind === "projected") return;
    if (virtual?.kind === "tutor") {
      applyRealizedTree(
        realizeTutorLine({
          tree: useGameStore.getState().tree,
          originNodeId: virtual.rootNodeId,
          uciPath: virtual.uciPath,
        }),
      );
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    bumpScheduler();
    if (!goToNode(nodeId)) return;
    const lesson = useGameStore.getState().lessons[nodeId];
    if (lesson) setCoachExpanded(true);
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

  function dismissNotice(id: string): void {
    setDismissedNotices((prev) => new Set(prev).add(id));
    if (id === "nav") queueNav(null);
  }

  return {
    promotion,
    settingsOpen,
    coachExpanded,
    timelineExpanded,
    navMessage,
    dismissedNotices,
    queueNav,
    setPromotion,
    setSettingsOpen,
    setCoachExpanded,
    setTimelineExpanded,
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
    handleCoachExpandedChange,
    handleDismissCoach,
    handleRequestHint,
    handleOpenCoach,
    handleSettingsOpenChange,
  };
}
