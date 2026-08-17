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
import { deriveBoardInteractivity } from "@/features/game/turn-controller";
import { pickBookReply } from "@/features/landing/hero-book";

/** Delay before a book reply lands, so it reads as a thought, not a glitch. */
const BOOK_REPLY_DELAY_MS = 450;

export type HeroPhase = "booting" | "resumed" | "playing";

export type HeroDemo = {
  phase: HeroPhase;
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
  /** Fresh demo game (resumed greeting or post-game rematch). */
  startFreshGame: () => void;
};

export const HERO_INTRO_COPY =
  "I'm your coach. Play a move — I'll tell you what I think of it. Try 1. e4.";
const HERO_RESUMED_COPY =
  "Welcome back! Your game is saved right where you left it.";
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
 * Landing-page playable demo on top of the real game store. Engines stay
 * cold until the visitor touches the board; a small opening book answers
 * instantly while Maia warms up. Once the visitor has played, the game
 * persists like any other, so /game resumes it seamlessly.
 */
export function useHeroDemo(): HeroDemo {
  const router = useRouter();
  const tree = useGameStore((s) => s.tree);
  const session = useGameStore((s) => s.session);
  const humanColor = useGameStore((s) => s.humanColor);
  const lessons = useGameStore((s) => s.lessons);
  const maiaElo = useGameStore((s) => s.preferences.maiaElo);
  const lastError = useGameStore((s) => s.lastError);
  const hydrate = useGameStore((s) => s.hydrate);
  const persist = useGameStore((s) => s.persist);

  const [maiaSession] = useState(() => createMaiaSession());
  const [coach] = useState(() => createCoachingController());
  const [phase, setPhase] = useState<HeroPhase>("booting");
  const [hasPlayed, setHasPlayed] = useState(false);
  const [coachPending, setCoachPending] = useState(false);

  const hasPlayedRef = useRef(false);
  const enginesStartedRef = useRef(false);
  const bootstrappedRef = useRef(false);
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

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    // A stale /game preset flag would make hydrate a no-op on the landing page.
    useGameStore.setState({ urlPresetApplied: false });
    void hydrate().then(() => {
      const state = useGameStore.getState();
      const inProgress =
        state.resumed &&
        state.session.mode !== "gameOver" &&
        Object.keys(state.tree.nodes).length > 1;
      if (inProgress) {
        setPhase("resumed");
        return;
      }
      state.startGame({ humanColor: "w" });
      setPhase("playing");
    });
  }, [hydrate]);

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

  /**
   * Normalize + persist so /game picks the live game up mid-flight. Marking
   * the preset flag makes /game trust the in-memory tree instead of
   * re-hydrating (the flag clears on the next played move).
   */
  function finalizeHandoff(): void {
    if (!hasPlayedRef.current) return;
    const state = useGameStore.getState();
    // A pending book reply dies with this component; let Maia answer instead.
    if (state.session.mode === "analyzing") {
      state.setMode("opponentThinking");
    }
    void state.persist();
    state.markUrlPresetApplied();
  }

  function continueOnFullBoard(): void {
    clearReplyTimer();
    finalizeHandoff();
    router.push("/game");
  }

  function startFreshGame(): void {
    clearReplyTimer();
    maiaSession.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    useGameStore.getState().startGame({ humanColor: "w" });
    setPhase("playing");
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
      finalizeHandoff();
      void maiaSession.dispose();
      void coach.dispose();
    };
    // Dispose-only cleanup; finalizeHandoff reads the store imperatively.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [maiaSession, coach]);

  const currentNode = getCurrentNode(tree);
  const fen = currentNode.fen;
  const status = getStatusAtNode(tree, tree.currentNodeId);
  const mode = session.mode;
  const gameOver = mode === "gameOver";

  const interactive =
    phase === "playing" &&
    deriveBoardInteractivity({
      liveMode: mode,
      liveFen: fen,
      humanColor,
      maiaFailed: maia.phase === "failed",
    });

  const isCheck = status.isCheck && !status.isGameOver;
  const boardMarks = styleBoardAnnotations(coaching.annotations);
  const analyzing = coachPending || coaching.phase === "analyzing";

  const mood: GatorMood = gameOver
    ? gameOverMood({
        result: status.result,
        terminalReason: session.terminalReason,
        humanColor,
      })
    : (coaching.insight?.classification ?? "idle");

  const notice =
    mode === "error"
      ? (lastError ?? "Something went wrong. The full board has a retry.")
      : gameOver
        ? gameOverNotice({ result: status.result, humanColor })
        : mode === "opponentThinking"
          ? maia.phase === "starting"
            ? (maia.message ?? "Waking Maia up…")
            : "Maia is thinking…"
          : null;

  const emptyCopy =
    phase === "resumed"
      ? HERO_RESUMED_COPY
      : coaching.phase === "failed"
        ? HERO_COACH_DOWN_COPY
        : hasPlayed
          ? null
          : HERO_INTRO_COPY;

  return {
    phase,
    board: {
      fen,
      interactive,
      lastMove: lastMoveSquares(currentNode.move?.uci ?? null),
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
