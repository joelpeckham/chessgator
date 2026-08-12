"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  getTurn,
  playMoveOnTree,
  type GameMove,
  type PieceSymbol,
} from "@/domain/game";
import { projectUciLine } from "@/domain/analysis";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import type { BoardMove } from "@/components/board/move-utils";
import {
  FeedbackStack,
  type FeedbackNotice,
} from "@/components/coach/feedback-stack";
import { PromotionDialog } from "@/components/game/promotion-dialog";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { MoveTimeline } from "@/components/timeline/move-timeline";
import {
  buildBranchGraph,
  isVirtualTimelineId,
  resolveReviewFen,
} from "@/components/timeline/branch-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  createCoachingController,
  type CoachingController,
} from "@/features/game/coaching-controller";
import {
  createMaiaSession,
  type MaiaSession,
} from "@/features/game/maia-session";
import { useGameStore } from "@/features/game/game-store";
import { getStatusPresentation } from "@/features/game/status-copy";
import { RiSettings3Line } from "@remixicon/react";

/** Reserved chrome so board size ignores floating coach/toasts. */
const HEADER_RESERVE_PX = 48;
/** Sticky timeline bar (includes branch lanes + transport). */
const TIMELINE_RESERVE_PX = 196;
const VIEWPORT_PAD_PX = 24;
const BOARD_MAX_PX = 960;
const BOARD_MIN_PX = 200;

function computeBoardSize(): number {
  if (typeof window === "undefined") return 640;
  const availW = window.innerWidth - VIEWPORT_PAD_PX;
  const availH =
    window.innerHeight - HEADER_RESERVE_PX - TIMELINE_RESERVE_PX - VIEWPORT_PAD_PX;
  return Math.max(
    BOARD_MIN_PX,
    Math.min(BOARD_MAX_PX, Math.floor(Math.min(availW, availH))),
  );
}

function kingSquareFromFen(fen: string, color: "w" | "b"): string | null {
  const board = fen.split(" ")[0] ?? "";
  const target = color === "w" ? "K" : "k";
  let rank = 8;
  let file = 0;
  for (const ch of board) {
    if (ch === "/") {
      rank -= 1;
      file = 0;
      continue;
    }
    if (ch >= "1" && ch <= "8") {
      file += Number(ch);
      continue;
    }
    if (ch === target) {
      return `${"abcdefgh"[file]}${rank}`;
    }
    file += 1;
  }
  return null;
}

/**
 * Client-only game composition. All workers, Zustand, and browser APIs stay here
 * (or below) so `page.tsx` can remain a static Server Component shell.
 */
export function GameShell() {
  const tree = useGameStore((s) => s.tree);
  const session = useGameStore((s) => s.session);
  const preferences = useGameStore((s) => s.preferences);
  const hydrated = useGameStore((s) => s.hydrated);
  const resumed = useGameStore((s) => s.resumed);
  const lastError = useGameStore((s) => s.lastError);
  const startGame = useGameStore((s) => s.startGame);
  const resumePlay = useGameStore((s) => s.resumePlay);
  const playMove = useGameStore((s) => s.playMove);
  const retryMove = useGameStore((s) => s.retryMove);
  const resign = useGameStore((s) => s.resign);
  const setMode = useGameStore((s) => s.setMode);
  const setMaiaElo = useGameStore((s) => s.setMaiaElo);
  const replaceTree = useGameStore((s) => s.replaceTree);
  const hydrate = useGameStore((s) => s.hydrate);
  const persist = useGameStore((s) => s.persist);

  const [maiaSession] = useState<MaiaSession>(() => createMaiaSession());
  const [coach] = useState<CoachingController>(() =>
    createCoachingController(),
  );

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

  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewNodeId, setReviewNodeId] = useState<string | null>(null);
  const [tutorPinned, setTutorPinned] = useState(false);
  const [navMessage, setNavMessage] = useState<string | null>(null);
  const [coachUnavailable, setCoachUnavailable] = useState<string | null>(null);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(
    () => new Set(),
  );
  const [engineNoticeArmed, setEngineNoticeArmed] = useState(false);
  // Client-only shell — size once from viewport; resize updates, coach chrome does not.
  const [boardSize, setBoardSize] = useState(computeBoardSize);
  const requestSeq = useRef(0);
  const bootstrappedRef = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveFen = getCurrentNode(tree).fen;
  const currentStatus = getStatusAtNode(tree, tree.currentNodeId);
  const moves = getMoveHistory(tree, tree.currentNodeId);
  const lastMove = moves[moves.length - 1] ?? null;
  const mode = session.mode;
  const isReviewing =
    reviewNodeId != null && reviewNodeId !== tree.currentNodeId;

  const tutorLine = useMemo(() => {
    const insight = coaching.insight;
    if (!insight?.lineUci.length || !coaching.evidence) return null;
    const analyzedId = coaching.evidence.gameNodeId;
    const analyzed = getNode(tree, analyzedId);
    const originId = analyzed?.parentId ?? tree.rootId;
    const origin = getNode(tree, originId);
    if (!origin) return null;
    return projectUciLine({
      rootFen: origin.fen,
      rootNodeId: originId,
      lineUci: insight.lineUci,
      kind: "tutor",
      maxPlies: 5,
    });
  }, [coaching.insight, coaching.evidence, tree]);

  const futureLine = coaching.futureLine;

  const graph = useMemo(
    () =>
      buildBranchGraph({
        tree,
        reviewNodeId,
        futureLine,
        tutorLine,
      }),
    [tree, reviewNodeId, futureLine, tutorLine],
  );

  const boardFen = resolveReviewFen(tree, graph, reviewNodeId);
  const boardStatus = useMemo(() => {
    // Prefer tree status when reviewing a real node; otherwise use live status.
    if (reviewNodeId && !isVirtualTimelineId(reviewNodeId)) {
      return getStatusAtNode(tree, reviewNodeId);
    }
    return getStatusAtNode(tree, tree.currentNodeId);
  }, [reviewNodeId, tree]);

  const enginesWarming =
    maia.phase === "starting" ||
    maia.phase === "idle" ||
    coaching.phase === "starting" ||
    coaching.phase === "idle";

  const interactive =
    mode === "playerTurn" &&
    getTurn(liveFen) === "w" &&
    !isReviewing &&
    maia.phase !== "failed";

  const checkSquare =
    boardStatus.isCheck && !boardStatus.isGameOver
      ? kingSquareFromFen(boardFen, boardStatus.turn)
      : null;

  const boardHighlights = coaching.annotations.highlightSquares;
  const boardLabels = coaching.annotations.labels;
  const boardArrows = coaching.annotations.arrows;

  const statusPresentation = getStatusPresentation({
    mode,
    status: currentStatus,
    terminalReason: session.terminalReason,
    maia,
    lastError: lastError ?? session.errorMessage,
    coachUnavailable,
    coachMessage: coaching.message,
    lastMove,
    navigationMessage: navMessage,
    enginesWarming,
  });

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const apply = () => setBoardSize(computeBoardSize());
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    void maiaSession.start();
    void coach.start().then((ok) => {
      if (!ok) {
        setCoachUnavailable(
          coach.getState().message ??
            "Coach analysis unavailable — play continues without post-move feedback.",
        );
      } else {
        setCoachUnavailable(null);
      }
    });
  }, [maiaSession, coach]);

  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const state = useGameStore.getState();
    if (state.resumed && state.session.mode === "reviewing") {
      resumePlay();
      const next = useGameStore.getState();
      if (next.session.mode === "opponentThinking") {
        void requestOpponentMove();
      }
      const timer = setTimeout(() => setNavMessage("Resumed local game"), 0);
      return () => clearTimeout(timer);
    }
    if (state.resumed && state.session.mode === "gameOver") {
      const timer = setTimeout(
        () =>
          setNavMessage("Loaded finished game — open settings for a new one"),
        0,
      );
      return () => clearTimeout(timer);
    }
    if (state.session.mode === "loading" || !state.resumed) {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once after hydrate
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void persist();
    }, 250);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [
    hydrated,
    tree,
    session.mode,
    session.terminalReason,
    preferences.maiaElo,
    persist,
  ]);

  useEffect(() => {
    return () => {
      void maiaSession.dispose();
      void coach.dispose();
    };
  }, [maiaSession, coach]);

  useEffect(() => {
    if (!navMessage) return;
    const id = setTimeout(() => setNavMessage(null), 2500);
    return () => clearTimeout(id);
  }, [navMessage]);

  useEffect(() => {
    if (!(enginesWarming && maia.phase !== "failed")) {
      const reset = setTimeout(() => setEngineNoticeArmed(false), 0);
      return () => clearTimeout(reset);
    }
    const arm = setTimeout(() => setEngineNoticeArmed(true), 400);
    return () => clearTimeout(arm);
  }, [enginesWarming, maia.phase]);

  useEffect(() => {
    if (!hydrated) return;
    if (mode === "gameOver" || mode === "error") return;
    const tipId = tree.currentNodeId;
    const tip = getNode(tree, tipId);
    if (!tip) return;
    void coach.projectFuture({
      fen: tip.fen,
      gameNodeId: tipId,
    });
  }, [hydrated, tree.currentNodeId, tree, mode, coach]);

  function resetPending(options?: { clearCoach?: boolean }): void {
    maiaSession.cancelPending();
    coach.cancelPending();
    if (options?.clearCoach) {
      coach.clearFeedback();
    }
    setReviewNodeId(null);
  }

  async function requestOpponentMove(): Promise<void> {
    const state = useGameStore.getState();
    if (state.session.mode !== "opponentThinking") return;

    const nodeId = state.tree.currentNodeId;
    const nodeFen = state.fen();
    const requestId = `opp-${++requestSeq.current}`;

    const ready = await maiaSession.whenReady();
    if (!ready) {
      const latest = useGameStore.getState();
      if (latest.session.mode === "opponentThinking") {
        latest.setMode(
          "error",
          maiaSession.getState().message ?? "Maia failed to start",
        );
      }
      return;
    }

    const result = await maiaSession.chooseMove({
      requestId,
      gameNodeId: nodeId,
      fen: nodeFen,
      selfElo: useGameStore.getState().preferences.maiaElo,
      oppoElo: useGameStore.getState().preferences.maiaElo,
      movetimeMs: 400,
    });

    const latest = useGameStore.getState();
    if (!result) {
      if (latest.session.mode === "opponentThinking") {
        latest.setMode(
          "error",
          maiaSession.getState().message ?? "Maia failed to move",
        );
      }
      return;
    }
    if (latest.tree.currentNodeId !== result.gameNodeId) return;
    if (latest.session.mode !== "opponentThinking") return;

    const applied = latest.playMove(result.moveUci);
    if (!applied) {
      latest.setMode(
        "error",
        latest.lastError ?? "Maia returned an illegal move",
      );
    }
  }

  async function runPostMoveCoaching(args: {
    fenBefore: string;
    gameNodeId: string;
    playedMove: GameMove;
  }): Promise<void> {
    const node = getNode(useGameStore.getState().tree, args.gameNodeId);
    if (!node) return;

    if (!coachUnavailable && coach.getState().phase !== "failed") {
      const requestId = `coach-${++requestSeq.current}`;
      await coach.analyzePlayerMove({
        requestId,
        gameNodeId: args.gameNodeId,
        fenBefore: args.fenBefore,
        fenAfter: node.fen,
        playedMove: args.playedMove,
      });
    }

    const latest = useGameStore.getState();
    if (latest.tree.currentNodeId !== args.gameNodeId) return;
    if (latest.session.mode !== "analyzing") return;
    const status = getStatusAtNode(latest.tree, args.gameNodeId);
    if (status.isGameOver) {
      latest.setMode("gameOver");
      return;
    }

    latest.setMode("opponentThinking");
    void requestOpponentMove();
  }

  async function handleRetryEngines(): Promise<void> {
    await maiaSession.dispose();
    await coach.dispose();
    const [maiaOk, coachOk] = await Promise.all([
      maiaSession.start(),
      coach.start(),
    ]);
    if (!maiaOk) {
      setMode("error", maiaSession.getState().message ?? "Maia failed to start");
      return;
    }
    setCoachUnavailable(
      coachOk
        ? null
        : (coach.getState().message ??
            "Coach analysis unavailable — play continues without post-move feedback."),
    );
    const state = useGameStore.getState();
    if (state.session.mode === "error") {
      setMode("playerTurn");
    }
  }

  async function handleRestart(): Promise<void> {
    resetPending({ clearCoach: true });
    useGameStore.setState({ resumed: false });
    startGame();
    setTutorPinned(false);
    setNavMessage("New game started");
  }

  function handleResign(): void {
    resetPending();
    resign("black");
  }

  function handleUndoMyMove(): void {
    resetPending({ clearCoach: true });
    const history = useGameStore.getState().history();
    const last = history[history.length - 1];
    if (last?.color === "b") {
      retryMove();
    }
    retryMove();
    setNavMessage("Undid your last move — try a different one");
  }

  function handleSelectTimelineNode(nodeId: string): void {
    if (nodeId === tree.currentNodeId) {
      setReviewNodeId(null);
      setNavMessage("Returned to live position");
      return;
    }
    setReviewNodeId(nodeId);
    const graphNode = graph.nodes.find((n) => n.id === nodeId);
    const label = graphNode?.san ?? "position";
    setNavMessage(`Viewing ${label}`);
  }

  function handleReturnLive(): void {
    setReviewNodeId(null);
    setNavMessage("Returned to live position");
  }

  function handleTrySuggested(): void {
    const insight = coach.getState().insight;
    const evidence = coach.getState().evidence;
    if (!insight?.suggestedMoveUci || !evidence) return;

    const analyzed = getNode(tree, evidence.gameNodeId);
    const originId = analyzed?.parentId ?? tree.rootId;

    const played = playMoveOnTree(tree, originId, insight.suggestedMoveUci);
    if (!played) {
      setNavMessage("Could not play that try-instead move");
      return;
    }

    maiaSession.cancelPending();
    coach.clearFeedback();
    replaceTree(played.tree);
    setReviewNodeId(null);

    const status = getStatusAtNode(played.tree, played.tree.currentNodeId);
    if (status.isGameOver) {
      setMode("gameOver");
    } else if (status.turn === "w") {
      setMode("playerTurn");
    } else {
      setMode("opponentThinking");
      void requestOpponentMove();
    }
    setNavMessage(
      `Trying ${played.node.move?.san ?? "alternate"} instead — prior line kept as a branch`,
    );
  }

  function applyPlayerMove(move: BoardMove | GameMove): boolean {
    if (!interactive) return false;
    const fenBefore = useGameStore.getState().fen();
    if (useGameStore.getState().session.mode === "loading") {
      setMode("playerTurn");
    }
    const ok = playMove(
      {
        from: move.from,
        to: move.to,
        promotion: "promotion" in move ? move.promotion : undefined,
      },
      { afterMode: "analyzing" },
    );
    if (!ok) return false;
    setPromotion(null);
    setReviewNodeId(null);
    coach.resetHints();

    const latest = useGameStore.getState();
    const node = getCurrentNode(latest.tree);
    if (!node.move) {
      latest.setMode("opponentThinking");
      void requestOpponentMove();
      return true;
    }

    void runPostMoveCoaching({
      fenBefore,
      gameNodeId: node.id,
      playedMove: node.move,
    });
    return true;
  }

  const canResign =
    mode === "playerTurn" ||
    mode === "opponentThinking" ||
    mode === "analyzing" ||
    mode === "reviewing";
  const canRestart = true;
  const canUndoMyMove =
    moves.some((m) => m.color === "w") &&
    (mode === "playerTurn" ||
      mode === "analyzing" ||
      mode === "reviewing" ||
      mode === "opponentThinking" ||
      mode === "gameOver");

  const notices: FeedbackNotice[] = [];
  if (
    engineNoticeArmed &&
    enginesWarming &&
    !dismissedNotices.has("engine-loading") &&
    maia.phase !== "failed"
  ) {
    notices.push({
      id: "engine-loading",
      title: "Downloading engines…",
      body: maia.message ?? "You can move — Maia will reply when ready.",
      busy: true,
      dismissible: true,
    });
  }
  if (maia.phase === "failed" || mode === "error") {
    notices.push({
      id: "engine-error",
      title: statusPresentation.headline,
      body: statusPresentation.detail,
      variant: "destructive",
      dismissible: false,
    });
  } else if (navMessage && !dismissedNotices.has("nav")) {
    notices.push({
      id: "nav",
      title: navMessage,
      dismissible: true,
    });
  }

  const tutorVisible =
    !coaching.insightDismissed &&
    (tutorPinned ||
      Boolean(coaching.insight) ||
      coaching.phase === "analyzing" ||
      mode === "analyzing" ||
      Boolean(coaching.hint));

  return (
    <TooltipProvider>
      <div
        className="game-shell relative flex h-dvh max-h-dvh flex-1 flex-col overflow-hidden bg-background"
        data-testid="game-shell"
        data-hydrated={hydrated ? "true" : "false"}
        data-resumed={resumed ? "true" : "false"}
        data-board-size={boardSize}
      >
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="live-region"
        >
          {statusPresentation.announcement}
        </div>

        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="font-heading text-base font-semibold tracking-tight sm:text-lg">
              chessgator
            </p>
            <Badge
              variant={statusPresentation.badgeVariant}
              data-testid="status-badge"
              data-mode={mode}
              data-opponent-phase={maia.phase}
            >
              {statusPresentation.badgeLabel}
            </Badge>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Open settings"
            data-testid="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            <RiSettings3Line />
          </Button>
        </header>

        <main className="relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2">
          <div
            className="relative shrink-0"
            style={{
              width: boardSize,
              height: boardSize,
            }}
            data-testid="board-frame"
          >
            <ChessboardAdapter
              fen={boardFen}
              interactive={interactive}
              lastMove={
                !isReviewing && lastMove
                  ? { from: lastMove.from, to: lastMove.to }
                  : null
              }
              isCheck={boardStatus.isCheck && !boardStatus.isGameOver}
              checkSquare={checkSquare}
              highlightSquares={isReviewing ? [] : boardHighlights}
              ghostSquares={[]}
              squareLabels={isReviewing ? [] : boardLabels}
              arrows={isReviewing ? [] : boardArrows}
              onMove={applyPlayerMove}
              onPromotionNeeded={(from, to) => setPromotion({ from, to })}
              className="h-full w-full"
            />
          </div>

          <FeedbackStack
            notices={notices}
            onDismissNotice={(id) => {
              setDismissedNotices((prev) => new Set(prev).add(id));
              if (id === "nav") setNavMessage(null);
            }}
            tutorOpen={tutorVisible}
            insight={coaching.insight}
            analyzing={
              coaching.phase === "analyzing" || mode === "analyzing"
            }
            canTakebackRetry={canUndoMyMove}
            onTakebackRetry={handleUndoMyMove}
            onTrySuggested={
              coaching.insight?.suggestedMoveUci && !coachUnavailable
                ? handleTrySuggested
                : undefined
            }
            onDismissTutor={() => {
              coach.dismissInsight();
              setTutorPinned(false);
            }}
            hint={coaching.hint}
            hintDisabled={!interactive || Boolean(coachUnavailable)}
            onRequestHint={() => {
              if (coachUnavailable) return;
              setTutorPinned(true);
              coach.showInsight();
              void coach.escalateHint({
                fen: liveFen,
                gameNodeId: tree.currentNodeId,
                sideToMove: "w",
              });
            }}
          />
        </main>

        <footer
          className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80"
          data-testid="timeline-bar"
        >
          <MoveTimeline
            tree={tree}
            reviewNodeId={reviewNodeId}
            futureLine={futureLine}
            tutorLine={tutorLine}
            disabled={mode === "error"}
            tutorOpen={tutorVisible}
            canOpenTutor={true}
            onSelectNode={handleSelectTimelineNode}
            onReturnLive={handleReturnLive}
            onToggleTutor={() => {
              if (tutorVisible) {
                coach.dismissInsight();
                setTutorPinned(false);
              } else {
                coach.showInsight(tree.currentNodeId);
                setTutorPinned(true);
              }
            }}
            className="rounded-none border-0 bg-transparent shadow-none ring-0"
          />
        </footer>

        <SettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          maiaElo={preferences.maiaElo}
          onMaiaEloChange={setMaiaElo}
          fen={liveFen}
          canPlayMove={interactive}
          onSelectMove={(move) => {
            applyPlayerMove(move);
          }}
          engineMessage={
            maia.phase === "failed"
              ? maia.message
              : enginesWarming
                ? (maia.message ?? "Starting engines…")
                : "Maia ready"
          }
          engineStarting={enginesWarming && maia.phase !== "failed"}
          engineFailed={maia.phase === "failed" || mode === "error"}
          coachMessage={
            coachUnavailable ??
            (coaching.phase === "failed" ? coaching.message : null)
          }
          onRetryEngines={() => {
            void handleRetryEngines();
          }}
          canResign={canResign}
          canRestart={canRestart}
          onResign={handleResign}
          onRestart={() => {
            void handleRestart();
          }}
        />

        <PromotionDialog
          open={promotion != null}
          from={promotion?.from ?? ""}
          to={promotion?.to ?? ""}
          onCancel={() => setPromotion(null)}
          onChoose={(piece: PieceSymbol) => {
            if (!promotion) return;
            applyPlayerMove({
              from: promotion.from,
              to: promotion.to,
              promotion: piece,
            });
          }}
        />
      </div>
    </TooltipProvider>
  );
}
