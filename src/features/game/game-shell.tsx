"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  createVariationExplorer,
  exitVariationExplorer,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getPathFenHistory,
  getStatusAtNode,
  getTurn,
  stepVariationBack,
  stepVariationForward,
  tryInsteadFromExplorer,
  type GameMove,
  type PieceSymbol,
  type VariationExplorerState,
} from "@/domain/game";
import { AccessibleMoveSelect } from "@/components/board/accessible-move-select";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import type { BoardMove } from "@/components/board/move-utils";
import { CoachPanel } from "@/components/coach/coach-panel";
import { GameControls } from "@/components/controls/game-controls";
import { LiveRegion } from "@/components/game/live-region";
import { PromotionDialog } from "@/components/game/promotion-dialog";
import { StatusPanel } from "@/components/game/status-panel";
import { MoveTimeline } from "@/components/timeline/move-timeline";
import { VariationExplorer } from "@/components/timeline/variation-explorer";
import {
  createCoachingController,
  evidenceToSummary,
  type CoachingController,
} from "@/features/game/coaching-controller";
import {
  createOpponentController,
  type OpponentController,
} from "@/features/game/opponent-controller";
import { useGameStore } from "@/features/game/game-store";

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

function formatStatusAnnouncement(args: {
  mode: string;
  lastMove: GameMove | null;
  opponentMessage: string | null;
  coachMessage: string | null;
  gameOverText: string | null;
  navigationMessage: string | null;
}): string {
  if (args.navigationMessage) return args.navigationMessage;
  if (args.gameOverText) return args.gameOverText;
  if (args.opponentMessage && args.mode === "loading") return args.opponentMessage;
  if (args.mode === "analyzing" && args.coachMessage) return args.coachMessage;
  if (args.lastMove) {
    const who = args.lastMove.color === "w" ? "White" : "Black";
    return `${who} played ${args.lastMove.san}`;
  }
  return args.opponentMessage ?? "Chess Tutor ready";
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
  const jumpToNode = useGameStore((s) => s.jumpToNode);
  const takeback = useGameStore((s) => s.takeback);
  const retryMove = useGameStore((s) => s.retryMove);
  const resign = useGameStore((s) => s.resign);
  const setMode = useGameStore((s) => s.setMode);
  const setMaiaElo = useGameStore((s) => s.setMaiaElo);
  const replaceTree = useGameStore((s) => s.replaceTree);
  const hydrate = useGameStore((s) => s.hydrate);
  const persist = useGameStore((s) => s.persist);

  const [controller] = useState<OpponentController>(() =>
    createOpponentController(),
  );
  const [coach] = useState<CoachingController>(() =>
    createCoachingController(),
  );

  const opponent = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const coaching = useSyncExternalStore(
    coach.subscribe,
    coach.getState,
    coach.getState,
  );

  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [explorer, setExplorer] = useState<VariationExplorerState | null>(null);
  const [navMessage, setNavMessage] = useState<string | null>(null);
  const [coachUnavailable, setCoachUnavailable] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const startingRef = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFen = getCurrentNode(tree).fen;
  const currentStatus = getStatusAtNode(tree, tree.currentNodeId);
  const moves = getMoveHistory(tree, tree.currentNodeId);
  const lastMove = moves[moves.length - 1] ?? null;
  const mode = session.mode;
  const exploring = explorer != null;

  const interactive =
    mode === "playerTurn" &&
    opponent.phase === "ready" &&
    getTurn(currentFen) === "w" &&
    !exploring;

  const checkSquare =
    currentStatus.isCheck && !currentStatus.isGameOver
      ? kingSquareFromFen(currentFen, currentStatus.turn)
      : null;

  const terminalReason = session.terminalReason ?? currentStatus.reason;
  const gameOverText =
    mode === "gameOver"
      ? terminalReason === "resignation"
        ? "You resigned. Game over."
        : `Game over. ${currentStatus.result}.`
      : null;

  const ghostOverlay = useMemo(() => {
    if (!explorer) {
      return {
        squares: [] as string[],
        arrows: [] as Array<{ from: string; to: string; color: string }>,
        labels: [] as Array<{ square: string; text: string }>,
      };
    }
    const squares = new Set<string>();
    const arrows: Array<{ from: string; to: string; color: string }> = [];
    const labels: Array<{ square: string; text: string }> = [];
    for (let i = 0; i < explorer.stepIndex; i += 1) {
      const uci = explorer.lineUci[i];
      if (!uci || uci.length < 4) continue;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      squares.add(from);
      squares.add(to);
      arrows.push({
        from,
        to,
        color: "color-mix(in oklch, var(--foreground) 55%, transparent)",
      });
      labels.push({ square: to, text: "var" });
    }
    return { squares: [...squares], arrows, labels };
  }, [explorer]);

  const boardHighlights = useMemo(() => {
    const set = new Set(coaching.annotations.highlightSquares);
    return [...set];
  }, [coaching.annotations.highlightSquares]);

  const boardLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of coaching.annotations.labels) {
      map.set(entry.square, entry.text);
    }
    for (const entry of ghostOverlay.labels) {
      map.set(entry.square, entry.text);
    }
    return [...map.entries()].map(([square, text]) => ({ square, text }));
  }, [coaching.annotations.labels, ghostOverlay.labels]);

  const boardArrows = useMemo(() => {
    return [...coaching.annotations.arrows, ...ghostOverlay.arrows];
  }, [coaching.annotations.arrows, ghostOverlay.arrows]);

  const announce = formatStatusAnnouncement({
    mode,
    lastMove,
    opponentMessage: opponent.message,
    coachMessage: coaching.message,
    gameOverText,
    navigationMessage: navMessage,
  });

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
    preferences.playerColor,
    persist,
  ]);

  useEffect(() => {
    return () => {
      void controller.dispose();
      void coach.dispose();
    };
  }, [controller, coach]);

  useEffect(() => {
    if (!navMessage) return;
    const id = setTimeout(() => setNavMessage(null), 2500);
    return () => clearTimeout(id);
  }, [navMessage]);

  async function requestOpponentMove(): Promise<void> {
    const state = useGameStore.getState();
    if (state.session.mode !== "opponentThinking") return;

    const nodeId = state.tree.currentNodeId;
    const nodeFen = state.fen();
    const path = getPathFenHistory(state.tree, nodeId);
    const historyFens = path.slice(0, -1);
    const requestId = `opp-${++requestSeq.current}`;

    const result = await controller.chooseMove({
      requestId,
      gameNodeId: nodeId,
      fen: nodeFen,
      historyFens,
      selfElo: state.preferences.maiaElo,
      oppoElo: state.preferences.maiaElo,
      movetimeMs: 400,
    });

    const latest = useGameStore.getState();
    if (!result) {
      if (latest.session.mode === "opponentThinking") {
        latest.setMode(
          "error",
          controller.getState().message ?? "Opponent failed to move",
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
        latest.lastError ?? "Opponent returned an illegal move",
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

    let evidence = null;
    if (!coachUnavailable && coach.getState().phase !== "failed") {
      const requestId = `coach-${++requestSeq.current}`;
      evidence = await coach.analyzePlayerMove({
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

    if (evidence) {
      useGameStore
        .getState()
        .attachAnalysis(args.gameNodeId, evidenceToSummary(evidence));
    }

    const status = getStatusAtNode(latest.tree, args.gameNodeId);
    if (status.isGameOver) {
      latest.setMode("gameOver");
      return;
    }

    latest.setMode("opponentThinking");
    void requestOpponentMove();
  }

  async function ensureEnginesReady(): Promise<boolean> {
    const oppReady = controller.getState().phase === "ready";
    const coachReady = coach.getState().phase === "ready";
    if (oppReady && coachReady) {
      setCoachUnavailable(null);
      return true;
    }

    const [oppOk, coachOk] = await Promise.all([
      oppReady ? Promise.resolve(true) : controller.start(),
      coachReady ? Promise.resolve(true) : coach.start(),
    ]);

    if (oppOk && coachOk) {
      setCoachUnavailable(null);
    } else if (oppOk && !coachOk) {
      setCoachUnavailable(
        coach.getState().message ??
          "Coach analysis unavailable — play continues without post-move feedback.",
      );
    }

    return oppOk;
  }

  async function handleStart(): Promise<void> {
    if (startingRef.current) return;
    startingRef.current = true;
    controller.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    exitExplorerQuiet();

    const ok = await ensureEnginesReady();
    if (!ok) {
      startingRef.current = false;
      setMode("error", controller.getState().message ?? "Engines failed");
      return;
    }

    const state = useGameStore.getState();
    if (state.resumed && state.session.mode === "reviewing") {
      resumePlay();
      const next = useGameStore.getState();
      if (next.session.mode === "opponentThinking") {
        void requestOpponentMove();
      }
      startingRef.current = false;
      setNavMessage("Resumed local game");
      return;
    }

    if (
      state.resumed &&
      state.session.mode === "gameOver" &&
      Object.keys(state.tree.nodes).length > 1
    ) {
      // Continue after resume of a finished game: review mode until restart.
      setMode("reviewing");
      startingRef.current = false;
      setNavMessage("Loaded finished game — use Restart for a new one");
      return;
    }

    startGame();
    coach.clearFeedback();
    startingRef.current = false;
  }

  async function handleRestart(): Promise<void> {
    controller.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    exitExplorerQuiet();
    useGameStore.setState({ resumed: false });
    await handleStart();
  }

  function handleResign(): void {
    controller.cancelPending();
    coach.cancelPending();
    exitExplorerQuiet();
    resign("black");
  }

  function handleTakebackRetry(): void {
    controller.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    exitExplorerQuiet();
    const history = useGameStore.getState().history();
    const last = history[history.length - 1];
    if (last?.color === "b") {
      retryMove();
    }
    retryMove();
    setNavMessage("Took back — try a different move");
  }

  function handleTimelineTakeback(): void {
    controller.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    exitExplorerQuiet();
    if (takeback()) {
      setNavMessage("Moved back one ply — earlier lines kept");
    }
  }

  function handleJump(nodeId: string): void {
    controller.cancelPending();
    coach.cancelPending();
    coach.clearFeedback();
    exitExplorerQuiet();
    if (jumpToNode(nodeId)) {
      const node = getNode(useGameStore.getState().tree, nodeId);
      const label = node?.move?.san ?? "start";
      setNavMessage(`Jumped to ${label}`);
    }
  }

  function exitExplorerQuiet(): void {
    if (!explorer) return;
    const next = exitVariationExplorer(useGameStore.getState().tree, explorer);
    replaceTree(next);
    setExplorer(null);
    coach.setShowLine(false);
  }

  function handleExitExplorer(): void {
    if (!explorer) return;
    const next = exitVariationExplorer(useGameStore.getState().tree, explorer);
    replaceTree(next);
    setExplorer(null);
    coach.setShowLine(false);
    setMode("reviewing");
    setNavMessage("Returned to origin position");
  }

  function handleExploreLine(): void {
    const coachingState = coach.getState();
    if (coachingState.phase === "analyzing" || mode === "analyzing") return;
    const insight = coachingState.insight;
    if (!insight?.lineUci.length) return;

    // Improvement line is validated from fenBefore — origin is the parent of the
    // analyzed (post-move) node. Refutation stays separate (shown on the card).
    const state = useGameStore.getState();
    const analyzedId =
      coachingState.evidence?.gameNodeId ?? state.tree.currentNodeId;
    const analyzed = getNode(state.tree, analyzedId);
    const originId = analyzed?.parentId ?? state.tree.rootId;

    const started = createVariationExplorer(
      state.tree,
      originId,
      insight.lineUci,
    );
    if (!started) {
      setNavMessage("Could not explore that line from this position");
      return;
    }
    controller.cancelPending();
    coach.cancelPending();
    replaceTree(started.tree);
    setExplorer(started.explorer);
    setMode("reviewing");
    coach.setShowLine(true);
    coach.setCardExpanded(true);
    setNavMessage(
      "Exploring better line — Try instead commits the suggested move",
    );
  }

  function handleVariationForward(): void {
    if (!explorer) return;
    const advanced = stepVariationForward(
      useGameStore.getState().tree,
      explorer,
    );
    if (!advanced) return;
    replaceTree(advanced.tree);
    setExplorer(advanced.explorer);
    setNavMessage(`Variation step ${advanced.explorer.stepIndex}`);
  }

  function handleVariationBack(): void {
    if (!explorer) return;
    const back = stepVariationBack(useGameStore.getState().tree, explorer);
    if (!back) return;
    replaceTree(back.tree);
    setExplorer(back.explorer);
    setNavMessage(
      back.explorer.stepIndex === 0
        ? "At variation origin"
        : `Variation step ${back.explorer.stepIndex}`,
    );
  }

  function handleTryInstead(): void {
    if (!explorer) return;
    const suggestedMoveUci = coach.getState().insight?.suggestedMoveUci ?? null;
    const tried = tryInsteadFromExplorer(
      useGameStore.getState().tree,
      explorer,
      { commitUci: suggestedMoveUci },
    );
    if (!tried) {
      setNavMessage("Could not play that try-instead move");
      return;
    }
    replaceTree(tried.tree);
    setExplorer(null);
    coach.clearFeedback();
    const status = getStatusAtNode(tried.tree, tried.tree.currentNodeId);
    if (status.isGameOver) {
      setMode("gameOver");
    } else if (status.turn === "w") {
      setMode("playerTurn");
    } else {
      setMode("opponentThinking");
      void requestOpponentMove();
    }
    setNavMessage(
      `Trying ${tried.node.move?.san ?? "alternate"} instead — main line preserved as a branch`,
    );
  }

  function applyPlayerMove(move: BoardMove | GameMove): boolean {
    if (!interactive) return false;
    const fenBefore = useGameStore.getState().fen();
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

  const canStart =
    (mode === "loading" ||
      mode === "gameOver" ||
      mode === "error" ||
      (mode === "reviewing" && resumed)) &&
    opponent.phase !== "starting" &&
    coaching.phase !== "starting";
  const canResign =
    !exploring &&
    (mode === "playerTurn" ||
      mode === "opponentThinking" ||
      mode === "analyzing" ||
      mode === "reviewing");
  const canRestart =
    opponent.phase === "ready" ||
    mode === "gameOver" ||
    mode === "error" ||
    mode === "playerTurn" ||
    mode === "opponentThinking" ||
    mode === "analyzing" ||
    mode === "reviewing";
  const canTakebackRetry =
    !exploring &&
    moves.some((m) => m.color === "w") &&
    (mode === "playerTurn" ||
      mode === "analyzing" ||
      mode === "reviewing" ||
      mode === "opponentThinking" ||
      mode === "gameOver");
  const canTimelineNav =
    !exploring &&
    (mode === "playerTurn" ||
      mode === "reviewing" ||
      mode === "analyzing" ||
      mode === "gameOver" ||
      mode === "opponentThinking");
  const canTimelineTakeback =
    canTimelineNav && Boolean(getCurrentNode(tree).parentId);

  return (
    <div
      className="game-shell relative flex min-h-full flex-1 flex-col"
      data-testid="game-shell"
      data-hydrated={hydrated ? "true" : "false"}
      data-resumed={resumed ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 game-shell-backdrop" aria-hidden />
      <LiveRegion message={announce} />

      <header className="relative z-10 border-b border-border/60 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4">
          <div>
            <p className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Chess Tutor
            </p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Local play against Maia with Stockfish-backed coaching. You are White.
            </p>
          </div>
          <p className="hidden text-xs text-muted-foreground md:block">
            No accounts · runs on your device
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:items-start sm:px-6">
        <div className="flex w-full flex-col items-center gap-3 md:flex-1 md:min-w-0">
          <ChessboardAdapter
            fen={currentFen}
            interactive={interactive}
            lastMove={
              lastMove ? { from: lastMove.from, to: lastMove.to } : null
            }
            isCheck={currentStatus.isCheck && !currentStatus.isGameOver}
            checkSquare={checkSquare}
            highlightSquares={boardHighlights}
            ghostSquares={ghostOverlay.squares}
            squareLabels={boardLabels}
            arrows={boardArrows}
            onMove={applyPlayerMove}
            onPromotionNeeded={(from, to) => setPromotion({ from, to })}
          />
          <p className="max-w-prose text-center text-xs text-muted-foreground">
            Drag, click a piece then a square, or use the keyboard move list.
            Legal targets, coach hints, and variation ghosts use patterns and
            labels — not color alone.
          </p>
        </div>

        <aside className="flex w-full flex-col gap-5 rounded-3xl bg-card/80 p-4 shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm md:w-88 md:shrink-0 lg:w-96">
          <StatusPanel
            mode={mode}
            status={currentStatus}
            terminalReason={session.terminalReason}
            opponent={opponent}
            lastError={lastError ?? session.errorMessage}
            coachUnavailable={coachUnavailable}
          />

          <GameControls
            maiaElo={preferences.maiaElo}
            onMaiaEloChange={setMaiaElo}
            canStart={canStart}
            canResign={canResign}
            canRestart={canRestart}
            resumeAvailable={resumed && mode === "reviewing"}
            starting={
              opponent.phase === "starting" || coaching.phase === "starting"
            }
            onStart={() => {
              void handleStart();
            }}
            onResign={handleResign}
            onRestart={() => {
              void handleRestart();
            }}
          />

          <CoachPanel
            insight={coaching.insight}
            hint={coaching.hint}
            expanded={coaching.cardExpanded}
            showLine={coaching.showLine}
            analyzing={coaching.phase === "analyzing" || mode === "analyzing"}
            exploringLine={exploring}
            hintsDisabled={!interactive || Boolean(coachUnavailable)}
            canTakebackRetry={canTakebackRetry}
            onToggleExpanded={() =>
              coach.setCardExpanded(!coaching.cardExpanded)
            }
            onShowLine={() => {
              if (coaching.phase === "analyzing" || mode === "analyzing") return;
              const next = !coaching.showLine;
              coach.setShowLine(next);
              if (next) coach.setCardExpanded(true);
            }}
            onExploreLine={
              coaching.phase === "analyzing" ||
              mode === "analyzing" ||
              coachUnavailable
                ? undefined
                : handleExploreLine
            }
            onTakebackRetry={handleTakebackRetry}
            onRequestHint={() => {
              if (coachUnavailable) return;
              void coach.escalateHint({
                fen: currentFen,
                gameNodeId: tree.currentNodeId,
                sideToMove: "w",
              });
            }}
          />

          <VariationExplorer
            explorer={explorer}
            onStepBack={handleVariationBack}
            onStepForward={handleVariationForward}
            onExit={handleExitExplorer}
            onTryInstead={handleTryInstead}
          />

          <AccessibleMoveSelect
            fen={currentFen}
            disabled={!interactive}
            onSelectMove={(move) => {
              applyPlayerMove(move);
            }}
          />

          <MoveTimeline
            tree={tree}
            disabled={!canTimelineNav}
            onJump={handleJump}
            onTakeback={handleTimelineTakeback}
            canTakeback={canTimelineTakeback}
          />
        </aside>
      </main>

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
  );
}
