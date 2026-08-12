"use client";

import { useEffect, useRef } from "react";
import type { BoardMove } from "@/components/board/move-utils";
import type { TimelineGraph } from "@/components/timeline/branch-graph";
import type { GameMove, GameTree } from "@/domain/game";
import type { CoachingController } from "@/features/game/coaching-controller";
import {
  playHumanMove,
  requestOpponentMove,
  runPostMoveCoaching,
  trySuggestedMove,
  undoHumanMove,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import type { MaiaSession } from "@/features/game/maia-session";

export function useGameFlow(args: {
  maiaSession: MaiaSession;
  coach: CoachingController;
  coachUnavailable: string | null;
  interactive: boolean;
  tree: GameTree;
  graph: TimelineGraph;
  retryEngines: () => Promise<void>;
  setNavMessage: (message: string | null) => void;
  setReviewNodeId: (id: string | null) => void;
  setPreviewNodeId: (id: string | null) => void;
  setCoachExpanded: (expanded: boolean) => void;
  setCoachUserCollapsedAuto: (collapsed: boolean) => void;
  setPromotion: (value: { from: string; to: string } | null) => void;
  setExpandedOverflowKeys: (keys: string[]) => void;
}): {
  applyPlayerMove: (move: BoardMove | GameMove) => boolean;
  handleTrySuggested: () => void;
  handleUndoMyMove: () => void;
  handleResign: () => void;
  handleRestart: () => void;
  handleRetryEngines: () => Promise<void>;
  handleSelectTimelineNode: (nodeId: string) => void;
  handleReturnLive: () => void;
  resetPending: (options?: { clearCoach?: boolean }) => void;
} {
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

  function resetPending(options?: { clearCoach?: boolean }): void {
    args.maiaSession.cancelPending();
    args.coach.cancelPending();
    if (options?.clearCoach) {
      args.coach.clearFeedback();
    }
    args.setReviewNodeId(null);
    args.setPreviewNodeId(null);
    args.setCoachExpanded(false);
    args.setCoachUserCollapsedAuto(false);
  }

  function requestOpponent(): void {
    void requestOpponentMove({
      maia: args.maiaSession,
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
      const timer = setTimeout(
        () => args.setNavMessage("Resumed local game"),
        0,
      );
      return () => clearTimeout(timer);
    }
    if (state.resumed && state.session.mode === "gameOver") {
      const timer = setTimeout(
        () =>
          args.setNavMessage(
            "Loaded finished game — open settings for a new one",
          ),
        0,
      );
      return () => clearTimeout(timer);
    }
    if (state.session.mode === "loading" || !state.resumed) {
      const hydrateError = state.lastError;
      startGame();
      if (hydrateError) {
        const timer = setTimeout(() => args.setNavMessage(hydrateError), 0);
        return () => clearTimeout(timer);
      }
    }
    // Bootstrap once after hydrate; startGame/resumePlay are stable store actions.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  function applyPlayerMove(move: BoardMove | GameMove): boolean {
    if (!args.interactive) return false;
    const played = playHumanMove({
      from: move.from,
      to: move.to,
      promotion: "promotion" in move ? move.promotion : undefined,
    });
    if (!played.ok) return false;
    args.setPromotion(null);
    args.setReviewNodeId(null);
    args.setPreviewNodeId(null);
    args.setCoachUserCollapsedAuto(false);
    args.setCoachExpanded(false);
    args.coach.resetHints();

    if (!played.node.move) {
      useGameStore.getState().setMode("opponentThinking");
      requestOpponent();
      return true;
    }

    void runPostMoveCoaching({
      coach: args.coach,
      fenBefore: played.fenBefore,
      gameNodeId: played.node.id,
      playedMove: played.node.move,
      coachUnavailable: args.coachUnavailable,
      requestId: nextRequestId("coach"),
      onReadyForOpponent: requestOpponent,
    });
    return true;
  }

  function handleTrySuggested(): void {
    const result = trySuggestedMove({
      tree: args.tree,
      insight: args.coach.getState().insight,
      evidence: args.coach.getState().evidence,
    });
    if (!result.ok) {
      args.setNavMessage(result.message);
      return;
    }
    args.maiaSession.cancelPending();
    args.coach.clearFeedback();
    replaceTree(result.tree);
    args.setReviewNodeId(null);
    args.setPreviewNodeId(null);
    setMode(result.mode);
    if (result.needsOpponent) {
      requestOpponent();
    }
    args.setNavMessage(result.message);
  }

  function handleUndoMyMove(): void {
    resetPending({ clearCoach: true });
    undoHumanMove();
    args.setNavMessage("Undid your last move — try a different one");
  }

  function handleResign(): void {
    resetPending();
    resign("black");
  }

  function handleRestart(): void {
    resetPending({ clearCoach: true });
    useGameStore.setState({ resumed: false });
    startGame();
    args.setExpandedOverflowKeys([]);
    args.setNavMessage("New game started");
  }

  async function handleRetryEngines(): Promise<void> {
    await args.retryEngines();
    if (useGameStore.getState().session.mode === "opponentThinking") {
      requestOpponent();
    }
  }

  function handleSelectTimelineNode(nodeId: string): void {
    if (nodeId === args.tree.currentNodeId) {
      args.setReviewNodeId(null);
      return;
    }
    args.setReviewNodeId(nodeId);
    const graphNode = args.graph.nodes.find((n) => n.id === nodeId);
    if (graphNode?.kind === "tutor") {
      args.coach.showInsight(graphNode.sourceNodeId);
      args.setCoachExpanded(true);
    }
  }

  function handleReturnLive(): void {
    args.setReviewNodeId(null);
    args.setPreviewNodeId(null);
  }

  return {
    applyPlayerMove,
    handleTrySuggested,
    handleUndoMyMove,
    handleResign,
    handleRestart,
    handleRetryEngines,
    handleSelectTimelineNode,
    handleReturnLive,
    resetPending,
  };
}
