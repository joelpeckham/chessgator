"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardMove } from "@/components/board/move-utils";
import { parseVirtualTimelineId } from "@/components/timeline/virtual-id";
import {
  type Color,
  type GameMove,
  getCurrentNode,
  type PruneScope,
} from "@/domain/game";
import { applyGamePresets } from "@/features/game/apply-game-presets";
import {
  playHumanMove,
  realizeSuggestedMove,
  requestOpponentMove,
  runPostMoveCoaching,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import { analyzedNodeIdForFocus } from "@/features/game/tree-graph";
import {
  deriveBoardInteractivity,
  deriveOpponentTarget,
  opponentTargetKey,
} from "@/features/game/turn-controller";
import type { GameRuntime } from "@/features/game/use-game-runtime";
import { parseGameSearch } from "@/lib/game-href";

export type ShellChrome = {
  promotion: { from: string; to: string } | null;
  settingsOpen: boolean;
  coachExpanded: boolean;
  /** Hint request in flight; balloon stays closed until content is ready. */
  hintPending: boolean;
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
  handleResign: () => void;
  handleRestart: () => void;
  setPendingHumanColor: (color: Color) => void;
  handleRetryEngines: () => Promise<void>;
  handleSelectTimelineNode: (nodeId: string) => void;
  handlePruneTimelineNode: (nodeId: string, scope: PruneScope) => void;
  handleCoachExpandedChange: (next: boolean) => void;
  handleRequestHint: () => void;
  handleClearHint: () => void;
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
  const [hintPending, setHintPending] = useState(false);
  const hintRequestRef = useRef(false);
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
  const pruneAtNode = useGameStore((s) => s.pruneAtNode);
  const replaceTree = useGameStore((s) => s.replaceTree);
  const hydrated = useGameStore((s) => s.hydrated);
  const liveMode = useGameStore((s) => s.session.mode);
  const liveTree = useGameStore((s) => s.tree);
  const liveCurrentId = liveTree.currentNodeId;

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
    liveTree,
  });
  const targetKey = opponentTargetKey(opponentTarget);

  if (liveMode !== "gameOver" && gameOverDismissed) {
    setGameOverDismissed(false);
  }

  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const state = useGameStore.getState();
    const presets = parseGameSearch(window.location.search);
    if (presets) {
      const applied = applyGamePresets(state, presets);
      if (applied.message) queueNav(applied.message);
      const url = new URL(window.location.href);
      if (url.search) {
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.hash}`,
        );
      }
      return;
    }
    if (state.urlPresetApplied) {
      if (state.session.mode === "reviewing") resumePlay();
      return;
    }
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
    }).then(() => {
      // Blunders auto-open the coach's advice; everything else stays opt-in.
      if (flowGen.current !== capturedGen) return;
      const coaching = runtime.coach.getState();
      if (
        coaching.insight?.nudge &&
        !coaching.insightDismissed &&
        coaching.evidence?.gameNodeId === gameNodeId
      ) {
        setCoachExpanded(true);
      }
    });
    return true;
  }

  function applyRealizedTree(
    tree: ReturnType<typeof realizeSuggestedMove>,
  ): void {
    if (!tree.ok) {
      queueNav(tree.message);
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    runtime.coach.resetHints();
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
      realizeSuggestedMove({
        tree,
        originNodeId: originId,
        uci: firstUci,
      }),
    );
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
    if (virtual?.kind === "suggested") {
      applyRealizedTree(
        realizeSuggestedMove({
          tree: useGameStore.getState().tree,
          originNodeId: virtual.rootNodeId,
          uci: virtual.uci,
        }),
      );
      return;
    }
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    bumpScheduler();
    if (!goToNode(nodeId)) return;
    runtime.coach.resetHints();
    const lesson = useGameStore.getState().lessons[nodeId];
    if (lesson) setCoachExpanded(true);
  }

  function handlePruneTimelineNode(nodeId: string, scope: PruneScope): void {
    if (parseVirtualTimelineId(nodeId)) return;
    const evidenceId = runtime.coach.getState().evidence?.gameNodeId;
    runtime.maiaSession.cancelPending();
    runtime.coach.cancelPending();
    bumpScheduler();
    if (!pruneAtNode(nodeId, scope)) return;
    const stillPresent =
      evidenceId != null &&
      useGameStore.getState().tree.nodes[evidenceId] != null;
    if (evidenceId && !stillPresent) {
      runtime.coach.clearFeedback();
      setCoachExpanded(false);
    }
  }

  function handleCoachExpandedChange(next: boolean): void {
    setCoachExpanded(next);
    if (next) {
      const analyzedId = analyzedFocusId();
      if (analyzedId) runtime.coach.showInsight(analyzedId);
    }
  }

  function handleRequestHint(): void {
    if (runtime.coachUnavailable || hintRequestRef.current) return;
    const tree = useGameStore.getState().tree;
    const gameNodeId = tree.currentNodeId;
    const expandWhenReady = !coachExpanded;
    runtime.coach.showInsight();
    hintRequestRef.current = true;
    setHintPending(true);
    void runtime.coach
      .escalateHint({
        fen: getCurrentNode(tree).fen,
        gameNodeId,
        sideToMove: useGameStore.getState().humanColor,
      })
      .then((built) => {
        if (!built) return;
        if (useGameStore.getState().tree.currentNodeId !== gameNodeId) return;
        if (expandWhenReady) setCoachExpanded(true);
      })
      .finally(() => {
        hintRequestRef.current = false;
        setHintPending(false);
      });
  }

  function handleClearHint(): void {
    runtime.coach.resetHints();
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
    hintPending,
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
    handleResign,
    handleRestart,
    pendingHumanColor,
    gameOverDismissed,
    setPendingHumanColor,
    dismissGameOver,
    handleRetryEngines,
    handleSelectTimelineNode,
    handlePruneTimelineNode,
    handleCoachExpandedChange,
    handleRequestHint,
    handleClearHint,
    handleOpenCoach,
    handleSettingsOpenChange,
  };
}
