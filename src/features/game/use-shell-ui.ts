"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardMove } from "@/components/board/move-utils";
import { parseVirtualTimelineId } from "@/components/timeline/branch-graph";
import {
  type Color,
  type GameMove,
  getCurrentNode,
  getTurn,
  isHumanTurn,
} from "@/domain/game";
import {
  playHumanMove,
  requestOpponentMove,
  runPostMoveCoaching,
  trySuggestedMove,
  undoHumanMove,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import type { GameRuntime } from "@/features/game/use-game-runtime";

export type ShellChrome = {
  /** Ephemeral timeline cursor — does not move `tree.currentNodeId`. */
  reviewNodeId: string | null;
  previewNodeId: string | null;
  promotion: { from: string; to: string } | null;
  settingsOpen: boolean;
  coachExpanded: boolean;
  expandedOverflowKeys: string[];
  navMessage: string | null;
  dismissedNotices: ReadonlySet<string>;
  pendingHumanColor: Color;
};

export type ShellUi = ShellChrome & {
  queueNav: (message: string | null) => void;
  setReviewNodeId: (id: string | null) => void;
  setPreviewNodeId: (id: string | null) => void;
  setPromotion: (value: { from: string; to: string } | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setCoachExpanded: (expanded: boolean) => void;
  setExpandedOverflowKeys: (keys: string[]) => void;
  dismissNotice: (id: string) => void;
  applyPlayerMove: (move: BoardMove | GameMove) => boolean;
  handleTrySuggested: () => void;
  handleUndoHumanMove: () => void;
  handleResign: () => void;
  handleRestart: () => void;
  setPendingHumanColor: (color: Color) => void;
  handleRetryEngines: () => Promise<void>;
  handleSelectTimelineNode: (nodeId: string) => void;
  handleReturnLive: () => void;
  handleCoachExpandedChange: (next: boolean) => void;
  handleDismissCoach: () => void;
  handleRequestHint: () => void;
  handleOpenCoach: () => void;
  handleSettingsOpenChange: (open: boolean) => void;
};

export function useShellUi(runtime: GameRuntime): ShellUi {
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewNodeId, setReviewNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [expandedOverflowKeys, setExpandedOverflowKeys] = useState<string[]>(
    [],
  );
  const [navMessage, setNavMessage] = useState<string | null>(null);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingHumanColor, setPendingHumanColor] = useState<Color>(
    () => useGameStore.getState().humanColor,
  );

  const startGame = useGameStore((s) => s.startGame);
  const resumePlay = useGameStore((s) => s.resumePlay);
  const resign = useGameStore((s) => s.resign);
  const replaceTree = useGameStore((s) => s.replaceTree);
  const setMode = useGameStore((s) => s.setMode);
  const hydrated = useGameStore((s) => s.hydrated);

  const requestSeq = useRef(0);
  const bootstrappedRef = useRef(false);

  function nextRequestId(prefix: string): string {
    requestSeq.current += 1;
    return `${prefix}-${requestSeq.current}`;
  }

  function queueNav(message: string | null): void {
    window.setTimeout(() => setNavMessage(message), 0);
  }

  function resetPending(options?: { clearCoach?: boolean }): void {
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    if (options?.clearCoach) {
      runtime.coach.clearFeedback();
    }
    setReviewNodeId(null);
    setPreviewNodeId(null);
    setCoachExpanded(false);
  }

  function requestOpponent(): void {
    void requestOpponentMove({
      maia: runtime.maiaSession,
      requestId: nextRequestId("opp"),
    });
  }

  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const state = useGameStore.getState();
    if (state.resumed && state.session.mode === "reviewing") {
      resumePlay();
      if (useGameStore.getState().session.mode === "opponentThinking") {
        requestOpponent();
      }
      queueNav("Resumed local game");
      return;
    }
    if (state.resumed && state.session.mode === "gameOver") {
      queueNav("Loaded finished game — open settings for a new one");
      return;
    }
    if (state.session.mode === "loading" || !state.resumed) {
      const hydrateError = state.lastError;
      startGame();
      if (hydrateError) {
        queueNav(hydrateError);
      }
    }
    if (useGameStore.getState().session.mode === "opponentThinking") {
      requestOpponent();
    }
    // Bootstrap once after hydrate; startGame/resumePlay are stable store actions.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  function isBoardInteractive(): boolean {
    const { tree, session } = useGameStore.getState();
    const liveFen = getCurrentNode(tree).fen;
    const viewedNodeId = previewNodeId ?? reviewNodeId;
    const isViewingNonLive =
      viewedNodeId != null && viewedNodeId !== tree.currentNodeId;
    return (
      session.mode === "playerTurn" &&
      isHumanTurn(getTurn(liveFen), useGameStore.getState().humanColor) &&
      !isViewingNonLive &&
      runtime.maia.phase !== "failed"
    );
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
    setReviewNodeId(null);
    setPreviewNodeId(null);
    setCoachExpanded(false);
    runtime.coach.resetHints();

    if (!played.node.move) {
      useGameStore.getState().setMode("opponentThinking");
      requestOpponent();
      return true;
    }

    void runPostMoveCoaching({
      coach: runtime.coach,
      fenBefore: played.fenBefore,
      gameNodeId: played.node.id,
      playedMove: played.node.move,
      coachUnavailable: runtime.coachUnavailable,
      requestId: nextRequestId("coach"),
      onReadyForOpponent: requestOpponent,
    });
    return true;
  }

  function handleTrySuggested(): void {
    const result = trySuggestedMove({
      tree: useGameStore.getState().tree,
      insight: runtime.coach.getState().insight,
      evidence: runtime.coach.getState().evidence,
    });
    if (!result.ok) {
      queueNav(result.message);
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.clearFeedback();
    replaceTree(result.tree);
    setReviewNodeId(null);
    setPreviewNodeId(null);
    setMode(result.mode);
    if (result.needsOpponent) {
      requestOpponent();
    }
    queueNav(result.message);
  }

  function handleUndoHumanMove(): void {
    resetPending({ clearCoach: true });
    undoHumanMove();
    queueNav("Undid your last move — try a different one");
  }

  function handleResign(): void {
    resetPending();
    resign();
  }

  function handleRestart(): void {
    resetPending({ clearCoach: true });
    useGameStore.setState({ resumed: false });
    startGame({ humanColor: pendingHumanColor });
    setExpandedOverflowKeys([]);
    if (useGameStore.getState().session.mode === "opponentThinking") {
      requestOpponent();
    }
    queueNav("New game started");
  }

  async function handleRetryEngines(): Promise<void> {
    await runtime.retryEngines();
    if (useGameStore.getState().session.mode === "opponentThinking") {
      requestOpponent();
    }
  }

  function handleSelectTimelineNode(nodeId: string): void {
    const currentId = useGameStore.getState().tree.currentNodeId;
    if (nodeId === currentId) {
      setReviewNodeId(null);
      return;
    }
    setReviewNodeId(nodeId);
    const virtual = parseVirtualTimelineId(nodeId);
    if (virtual?.kind === "tutor") {
      runtime.coach.showInsight(virtual.rootNodeId);
      setCoachExpanded(true);
    }
  }

  function handleReturnLive(): void {
    setReviewNodeId(null);
    setPreviewNodeId(null);
  }

  function handleCoachExpandedChange(next: boolean): void {
    setCoachExpanded(next);
    if (next) {
      runtime.coach.showInsight(useGameStore.getState().tree.currentNodeId);
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
    runtime.coach.showInsight(useGameStore.getState().tree.currentNodeId);
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
    reviewNodeId,
    previewNodeId,
    promotion,
    settingsOpen,
    coachExpanded,
    expandedOverflowKeys,
    navMessage,
    dismissedNotices,
    queueNav,
    setReviewNodeId,
    setPreviewNodeId,
    setPromotion,
    setSettingsOpen,
    setCoachExpanded,
    setExpandedOverflowKeys,
    dismissNotice,
    applyPlayerMove,
    handleTrySuggested,
    handleUndoHumanMove,
    handleResign,
    handleRestart,
    pendingHumanColor,
    setPendingHumanColor,
    handleRetryEngines,
    handleSelectTimelineNode,
    handleReturnLive,
    handleCoachExpandedChange,
    handleDismissCoach,
    handleRequestHint,
    handleOpenCoach,
    handleSettingsOpenChange,
  };
}
