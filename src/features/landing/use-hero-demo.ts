"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { styleBoardAnnotations } from "@/components/board/annotation-style";
import type { BoardArrow } from "@/components/board/arrow-utils";
import type { BoardMove } from "@/components/board/move-utils";
import { lastMoveSquares } from "@/components/board/move-utils";
import {
  type GatorMood,
  gameOverMood,
} from "@/components/coach/gator-expression";
import {
  findKingSquare,
  getCurrentNode,
  getNode,
  getStatusAtNode,
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import { createCoachingController } from "@/features/game/coaching-controller";
import { playHumanMove, requestOpponentMove } from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import { createMaiaSession } from "@/features/game/maia-session";
import { pickBookReply } from "@/features/landing/hero-book";
import { handOffHeroGame } from "@/features/landing/hero-handoff";
import { heroBoardView } from "@/features/landing/hero-view";

/** Delay before a book reply lands, so it reads as a thought, not a glitch. */
const BOOK_REPLY_DELAY_MS = 450;

export type HeroDemo = {
  board: {
    fen: string;
    interactive: boolean;
    lastMove: { from: string; to: string } | null;
    isCheck: boolean;
    checkSquare: string | null;
    highlightSquares: string[];
    labels: Array<{ square: string; text: string }>;
    arrows: BoardArrow[];
  };
  coach: {
    insight: TeachingInsight | null;
    analyzing: boolean;
    mood: GatorMood;
    emptyCopy: string | null;
  };
  /** Engine / result status line under the board; null when quiet. */
  notice: string | null;
  hasPlayed: boolean;
  gameOver: boolean;
  handleMove: (move: BoardMove) => boolean;
  /** Warm the engines on first board interaction. */
  warmEngines: () => void;
  /** Persist + hand the live game to /game. */
  continueOnFullBoard: () => void;
  /** Fresh demo game (post-game rematch). */
  startFreshGame: () => void;
};

export const HERO_INTRO_COPY =
  "I'm your coach. Play a move — I'll tell you what I think of it. Try 1. e4.";
const HERO_COACH_DOWN_COPY =
  "The coach couldn't start, but Maia still plays. The full board has a retry.";

function gameOverNotice(args: {
  result: "whiteWins" | "blackWins" | "draw" | "ongoing";
  humanColor: "w" | "b";
}): string {
  if (args.result === "draw") return "It's a draw. Well held.";
  const humanWon =
    (args.result === "whiteWins" && args.humanColor === "w") ||
    (args.result === "blackWins" && args.humanColor === "b");
  return humanWon
    ? "Checkmate — you won! The gator is impressed."
    : "Checkmate — Maia got you. Rematch?";
}

/**
 * Landing-page playable demo on top of the real game store. It is always a
 * fresh game: the board shows the starting position and accepts moves
 * immediately, never hydrating (or locking on) a saved game — that stays
 * intact for /game unless the visitor plays here. Engines stay cold until
 * the visitor touches the board; a small opening book answers instantly
 * while Maia warms up. Once the visitor has played, the game persists like
 * any other, so /game resumes it seamlessly.
 */
export function useHeroDemo(): HeroDemo {
  const router = useRouter();
  const tree = useGameStore((s) => s.tree);
  const session = useGameStore((s) => s.session);
  const humanColor = useGameStore((s) => s.humanColor);
  const lessons = useGameStore((s) => s.lessons);
  const maiaElo = useGameStore((s) => s.preferences.maiaElo);
  const lastError = useGameStore((s) => s.lastError);
  const persist = useGameStore((s) => s.persist);

  const [maiaSession] = useState(() => createMaiaSession());
  const [coach] = useState(() => createCoachingController());
  const [hasPlayed, setHasPlayed] = useState(false);
  const [coachPending, setCoachPending] = useState(false);

  const hasPlayedRef = useRef(false);
  const enginesStartedRef = useRef(false);
  const replyTimer = useRef<number | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const maia = useSyncExternalStore(
    maiaSession.subscribe,
    maiaSession.getState,
    maiaSession.getState,
  );
  const coaching = useSyncExternalStore(
    coach.subscribe,
    coach.getState,
    coach.getState,
  );

  function clearReplyTimer(): void {
    if (replyTimer.current != null) {
      window.clearTimeout(replyTimer.current);
      replyTimer.current = null;
    }
  }

  function warmEngines(): void {
    if (enginesStartedRef.current) return;
    enginesStartedRef.current = true;
    void maiaSession.start();
    void coach.start();
  }

  function scheduleReply(gameNodeId: string, fenAfter: string): void {
    const state = useGameStore.getState();
    if (state.session.mode === "gameOver") return;

    const bookUci = pickBookReply(fenAfter);
    if (bookUci) {
      clearReplyTimer();
      replyTimer.current = window.setTimeout(() => {
        replyTimer.current = null;
        const latest = useGameStore.getState();
        if (latest.tree.currentNodeId !== gameNodeId) return;
        if (latest.session.mode !== "analyzing") return;
        latest.playMove(bookUci);
      }, BOOK_REPLY_DELAY_MS);
      return;
    }

    requestSeq.current += 1;
    state.setMode("opponentThinking");
    void requestOpponentMove({
      maia: maiaSession,
      requestId: `hero-opp-${requestSeq.current}`,
    });
  }

  function handleMove(move: BoardMove): boolean {
    warmEngines();
    if (!hasPlayedRef.current) {
      // First hero move: only now does the demo claim the shared store.
      // The board showed the starting position, so this seats the same one.
      useGameStore.getState().startGame({ humanColor: "w" });
    }
    const played = playHumanMove(move);
    if (!played.ok) return false;
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      setHasPlayed(true);
    }

    const node = played.node;
    if (node.move) {
      requestSeq.current += 1;
      const playedMove = node.move;
      const previousMove = node.parentId
        ? (getNode(useGameStore.getState().tree, node.parentId)?.move ?? null)
        : null;
      setCoachPending(true);
      void coach
        .analyzePlayerMove({
          requestId: `hero-coach-${requestSeq.current}`,
          gameNodeId: node.id,
          fenBefore: played.fenBefore,
          fenAfter: node.fen,
          playedMove,
          previousMove,
        })
        .then((evidence) => {
          if (!evidence) return;
          const insight = coach.getState().insight;
          const latest = useGameStore.getState();
          if (insight && latest.tree.nodes[node.id]) {
            latest.setLesson(node.id, insight);
          }
        })
        .finally(() => setCoachPending(false));
    }

    scheduleReply(node.id, node.fen);
    return true;
  }

  function continueOnFullBoard(): void {
    clearReplyTimer();
    handOffHeroGame(hasPlayedRef.current);
    router.push("/game");
  }

  function startFreshGame(): void {
    clearReplyTimer();
    maiaSession.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    useGameStore.getState().startGame({ humanColor: "w" });
  }

  useEffect(() => {
    if (!hasPlayed) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      void persist();
    }, 250);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [hasPlayed, tree, session, lessons, maiaElo, humanColor, persist]);

  useEffect(() => {
    function flush(): void {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      if (hasPlayedRef.current) {
        void useGameStore.getState().persist();
      }
    }
    function onPageHide(): void {
      flush();
    }
    function onVisibility(): void {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (replyTimer.current != null) {
        window.clearTimeout(replyTimer.current);
        replyTimer.current = null;
      }
      if (hasPlayedRef.current) {
        void useGameStore.getState().persist();
      }
      void maiaSession.dispose();
      void coach.dispose();
    };
    // Dispose-only cleanup; persist reads the store imperatively.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [maiaSession, coach]);

  const currentNode = getCurrentNode(tree);
  const status = getStatusAtNode(tree, tree.currentNodeId);
  const mode = session.mode;

  const view = heroBoardView({
    started: hasPlayed,
    liveMode: mode,
    liveFen: currentNode.fen,
    humanColor,
    maiaFailed: maia.phase === "failed",
  });
  const fen = view.fen;
  const gameOver = view.gameOver;

  const isCheck = hasPlayed && status.isCheck && !status.isGameOver;
  const boardMarks = styleBoardAnnotations(coaching.annotations);
  const analyzing = coachPending || coaching.phase === "analyzing";

  const mood: GatorMood = gameOver
    ? gameOverMood({
        result: status.result,
        terminalReason: session.terminalReason,
        humanColor,
      })
    : (coaching.insight?.classification ?? "idle");

  const notice = !hasPlayed
    ? null
    : mode === "error"
      ? (lastError ?? "Something went wrong. The full board has a retry.")
      : gameOver
        ? gameOverNotice({ result: status.result, humanColor })
        : mode === "opponentThinking"
          ? maia.phase === "starting"
            ? (maia.message ?? "Waking Maia up…")
            : "Maia is thinking…"
          : null;

  const emptyCopy =
    coaching.phase === "failed"
      ? HERO_COACH_DOWN_COPY
      : hasPlayed
        ? null
        : HERO_INTRO_COPY;

  return {
    board: {
      fen,
      interactive: view.interactive,
      lastMove: hasPlayed
        ? lastMoveSquares(currentNode.move?.uci ?? null)
        : null,
      isCheck,
      checkSquare: isCheck ? findKingSquare(fen, status.turn) : null,
      highlightSquares: boardMarks.highlightSquares,
      labels: boardMarks.labels,
      arrows: boardMarks.arrows,
    },
    coach: {
      insight: coaching.insight,
      analyzing,
      mood,
      emptyCopy,
    },
    notice,
    hasPlayed,
    gameOver,
    handleMove,
    warmEngines,
    continueOnFullBoard,
    startFreshGame,
  };
}
