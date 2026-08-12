import {
  buildMoveAnalysisEvidence,
  projectBestFuture,
  type MoveAnalysisEvidence,
  type ProjectedLine,
} from "@/domain/analysis";
import type { GameMove } from "@/domain/game";
import {
  buildHintStep,
  nextHintLevel,
  selectTeachingInsight,
  type HintLevel,
  type HintStep,
  type TeachingInsight,
} from "@/domain/teaching";
import { StockfishClient } from "@/engines/stockfish";
import { markEnd, markStart } from "@/features/game/perf-marks";
import {
  createStubAnalysisEngine,
  type CreateAnalysisEngineFn,
  type StockfishClientLike,
} from "@/features/game/stub-analysis";

export type CoachingPhase =
  | "idle"
  | "starting"
  | "ready"
  | "analyzing"
  | "failed";

export type BoardAnnotation = {
  highlightSquares: string[];
  arrows: Array<{ from: string; to: string; color: string }>;
  /** Accessible labels paired with highlights (not color-only). */
  labels: Array<{ square: string; text: string }>;
};

export type CoachingControllerState = {
  phase: CoachingPhase;
  message: string | null;
  evidence: MoveAnalysisEvidence | null;
  insight: TeachingInsight | null;
  hintLevel: HintLevel;
  hint: HintStep | null;
  annotations: BoardAnnotation;
  /** Soft-dismissed tutor card; insight remains cached for reopen. */
  insightDismissed: boolean;
  /** Latest projected future for the active projection node. */
  futureLine: ProjectedLine | null;
  futureNodeId: string | null;
};

export type AnalyzePlayerMoveInput = {
  requestId: string;
  gameNodeId: string;
  fenBefore: string;
  fenAfter: string;
  playedMove: GameMove;
  movetimeMs?: number;
};

export type CoachingController = {
  getState: () => CoachingControllerState;
  subscribe: (listener: () => void) => () => void;
  start: () => Promise<boolean>;
  whenReady: () => Promise<boolean>;
  analyzePlayerMove: (
    input: AnalyzePlayerMoveInput,
  ) => Promise<MoveAnalysisEvidence | null>;
  projectFuture: (input: {
    fen: string;
    gameNodeId: string;
    movetimeMs?: number;
  }) => Promise<ProjectedLine | null>;
  getCachedInsight: (gameNodeId: string) => TeachingInsight | null;
  dismissInsight: () => void;
  showInsight: (gameNodeId?: string | null) => void;
  escalateHint: (input: {
    fen: string;
    gameNodeId: string;
    sideToMove?: "w" | "b";
  }) => Promise<HintStep | null>;
  resetHints: () => void;
  clearFeedback: () => void;
  cancelPending: () => void;
  dispose: () => Promise<void>;
};

export type CreateCoachingControllerOptions = {
  /** Injectable StockfishClient-like factory (tests / e2e stubs). */
  createEngine?: CreateAnalysisEngineFn;
  defaultMovetimeMs?: number;
};

declare global {
  interface Window {
    __chessgatorCreateAnalysisEngine?: CreateAnalysisEngineFn;
  }
}

const EMPTY_ANNOTATIONS: BoardAnnotation = {
  highlightSquares: [],
  arrows: [],
  labels: [],
};

const IDLE: CoachingControllerState = {
  phase: "idle",
  message: null,
  evidence: null,
  insight: null,
  hintLevel: 0,
  hint: null,
  annotations: EMPTY_ANNOTATIONS,
  insightDismissed: false,
  futureLine: null,
  futureNodeId: null,
};

const FUTURE_CACHE_LIMIT = 24;

/**
 * Owns Stockfish-backed move analysis + hint ladder for the coaching slice.
 * Ignores stale/cancelled results via request ids and current game-node id.
 */
export function createCoachingController(
  options: CreateCoachingControllerOptions = {},
): CoachingController {
  const createEngine = options.createEngine ?? resolveDefaultEngine;
  const defaultMovetimeMs = options.defaultMovetimeMs ?? 180;
  const listeners = new Set<() => void>();

  let engine: StockfishClientLike | null = null;
  let disposed = false;
  let activeRequestId: string | null = null;
  let generation = 0;
  let startPromise: Promise<boolean> | null = null;
  let state: CoachingControllerState = { ...IDLE };
  const insightByNodeId = new Map<string, TeachingInsight>();
  const futureByNodeId = new Map<string, ProjectedLine>();

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function setState(partial: Partial<CoachingControllerState>): void {
    state = { ...state, ...partial };
    emit();
  }

  function rememberFuture(nodeId: string, line: ProjectedLine | null): void {
    if (!line) {
      futureByNodeId.delete(nodeId);
      return;
    }
    futureByNodeId.set(nodeId, line);
    if (futureByNodeId.size > FUTURE_CACHE_LIMIT) {
      const first = futureByNodeId.keys().next().value;
      if (first) futureByNodeId.delete(first);
    }
  }

  function annotationsFromInsight(
    insight: TeachingInsight | null,
    evidence: MoveAnalysisEvidence | null,
    hint: HintStep | null,
  ): BoardAnnotation {
    const highlightSquares = new Set<string>();
    const arrows: BoardAnnotation["arrows"] = [];
    const labels: BoardAnnotation["labels"] = [];

    if (hint) {
      for (const sq of hint.highlightSquares) highlightSquares.add(sq);
      if (hint.candidateMoveUci && hint.candidateMoveUci.length >= 4) {
        arrows.push({
          from: hint.candidateMoveUci.slice(0, 2),
          to: hint.candidateMoveUci.slice(2, 4),
          color: "var(--primary)",
        });
        labels.push({
          square: hint.candidateMoveUci.slice(2, 4),
          text: "hint",
        });
      }
      if (hint.level >= 3) {
        for (const uci of hint.lineUci) {
          if (uci.length < 4) continue;
          arrows.push({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            color: "color-mix(in oklch, var(--primary) 70%, transparent)",
          });
        }
      }
    }

    if (insight?.suggestedMoveUci && insight.autoExpand && evidence) {
      const uci = insight.suggestedMoveUci;
      if (uci.length >= 4) {
        arrows.push({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          color: "var(--primary)",
        });
        labels.push({ square: uci.slice(2, 4), text: "better" });
      }
    }

    return {
      highlightSquares: [...highlightSquares],
      arrows,
      labels,
    };
  }

  function refreshAnnotations(partial: Partial<CoachingControllerState> = {}): void {
    const next = { ...state, ...partial };
    const annotations = annotationsFromInsight(
      next.insight,
      next.evidence,
      next.hint,
    );
    setState({ ...partial, annotations });
  }

  const controller: CoachingController = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      if (
        (state.phase === "ready" || state.phase === "analyzing") &&
        engine &&
        !disposed
      ) {
        return true;
      }
      if (startPromise) {
        return startPromise;
      }

      disposed = false;
      generation += 1;
      const startGen = generation;
      startPromise = (async () => {
        const previousEngine = engine;
        if (previousEngine) {
          try {
            await previousEngine.dispose();
          } catch {
            // ignore
          }
          if (engine === previousEngine) {
            engine = null;
          }
        }

        if (disposed || startGen !== generation) return false;

        const currentEngine = createEngine();
        engine = currentEngine;
        markStart("engine-coach-startup");
        setState({
          ...IDLE,
          phase: "starting",
          message: "Starting coach analysis…",
        });
        try {
          await currentEngine.initialize();
          if (
            disposed ||
            startGen !== generation ||
            engine !== currentEngine
          ) {
            return false;
          }
          setState({
            phase: "ready",
            message: "Coach ready",
          });
          markEnd("engine-coach-startup");
          return true;
        } catch (err) {
          if (
            disposed ||
            startGen !== generation ||
            engine !== currentEngine
          ) {
            return false;
          }
          const message =
            err instanceof Error ? err.message : "Coach analysis failed";
          setState({ phase: "failed", message });
          markEnd("engine-coach-startup");
          return false;
        } finally {
          if (startGen === generation) {
            startPromise = null;
          }
        }
      })();

      return startPromise;
    },

    async whenReady() {
      // Analyzing means the engine is already up — never restart mid-request.
      if (state.phase === "ready" || state.phase === "analyzing") return true;
      if (state.phase === "failed") return false;
      if (startPromise) return startPromise;
      return controller.start();
    },

    async analyzePlayerMove(input) {
      if (
        !engine ||
        state.phase === "idle" ||
        state.phase === "starting" ||
        state.phase === "failed"
      ) {
        const ready = await controller.whenReady();
        if (!ready || !engine || state.phase === "failed") {
          return null;
        }
      }

      this.cancelPending();
      activeRequestId = input.requestId;
      const gen = generation;
      engine.setCurrentGameNodeId(input.gameNodeId);
      markStart("analysis-player-move");
      // Set analyzing synchronously before the first engine await so UI / tests
      // observe the in-flight phase immediately.
      setState({
        phase: "analyzing",
        message: "Analyzing your move…",
        evidence: null,
        insight: null,
        insightDismissed: false,
        hint: null,
        hintLevel: 0,
        annotations: EMPTY_ANNOTATIONS,
      });

      const movetimeMs = input.movetimeMs ?? defaultMovetimeMs;
      const beforeId = `${input.requestId}-before`;
      const afterId = `${input.requestId}-after`;

      const isStale = () =>
        disposed ||
        gen !== generation ||
        activeRequestId !== input.requestId;

      const leaveAnalyzingIfOrphaned = () => {
        if (
          !disposed &&
          gen === generation &&
          activeRequestId === null &&
          state.phase === "analyzing"
        ) {
          setState({ phase: "ready", message: null });
        }
      };

      try {
        const before = await engine.analyze({
          requestId: beforeId,
          gameNodeId: input.gameNodeId,
          fen: input.fenBefore,
          priority: "user",
          multipv: 3,
          movetimeMs,
        });
        if (isStale()) {
          leaveAnalyzingIfOrphaned();
          markEnd("analysis-player-move");
          return null;
        }

        const after = await engine.analyze({
          requestId: afterId,
          gameNodeId: input.gameNodeId,
          fen: input.fenAfter,
          priority: "user",
          multipv: 2,
          movetimeMs: Math.max(80, Math.floor(movetimeMs * 0.75)),
        });
        if (isStale()) {
          leaveAnalyzingIfOrphaned();
          markEnd("analysis-player-move");
          return null;
        }

        const evidence = buildMoveAnalysisEvidence({
          requestId: input.requestId,
          gameNodeId: input.gameNodeId,
          playedMove: input.playedMove,
          fenBefore: input.fenBefore,
          fenAfter: input.fenAfter,
          before,
          after,
        });
        const insight = selectTeachingInsight(evidence);
        insightByNodeId.set(input.gameNodeId, insight);

        refreshAnnotations({
          phase: "ready",
          message: null,
          evidence,
          insight,
          insightDismissed: false,
          hint: null,
          hintLevel: 0,
        });
        activeRequestId = null;
        markEnd("analysis-player-move");
        return evidence;
      } catch (err) {
        if (isStale()) {
          leaveAnalyzingIfOrphaned();
          markEnd("analysis-player-move");
          return null;
        }
        const message =
          err instanceof Error ? err.message : "Analysis failed";
        setState({
          phase: "ready",
          message: message.includes("cancelled") || message.includes("Stale")
            ? null
            : message,
        });
        activeRequestId = null;
        markEnd("analysis-player-move");
        return null;
      }
    },

    async projectFuture(input) {
      const cached = futureByNodeId.get(input.gameNodeId);
      if (cached) {
        setState({
          futureLine: cached,
          futureNodeId: input.gameNodeId,
        });
        return cached;
      }

      const ready = await controller.whenReady();
      if (!ready || !engine || state.phase === "failed") {
        return null;
      }

      const requestId = `future-${generation}-${input.gameNodeId}`;
      try {
        const evidence = await engine.analyze({
          requestId,
          gameNodeId: input.gameNodeId,
          fen: input.fen,
          priority: "background",
          multipv: 1,
          movetimeMs: input.movetimeMs ?? Math.max(80, defaultMovetimeMs),
        });
        if (disposed) return null;
        const line = projectBestFuture(evidence);
        rememberFuture(input.gameNodeId, line);
        setState({
          futureLine: line,
          futureNodeId: input.gameNodeId,
        });
        return line;
      } catch {
        return null;
      }
    },

    getCachedInsight(gameNodeId) {
      return insightByNodeId.get(gameNodeId) ?? null;
    },

    dismissInsight() {
      setState({ insightDismissed: true });
    },

    showInsight(gameNodeId) {
      if (gameNodeId) {
        const cached = insightByNodeId.get(gameNodeId);
        if (cached) {
          refreshAnnotations({
            insight: cached,
            insightDismissed: false,
          });
          return;
        }
      }
      setState({ insightDismissed: false });
    },

    async escalateHint(input) {
      if (
        !engine ||
        state.phase === "idle" ||
        state.phase === "starting" ||
        state.phase === "failed"
      ) {
        const ready = await controller.whenReady();
        if (!ready || !engine || state.phase === "failed") {
          return null;
        }
      }
      const nextLevel = state.hint ? nextHintLevel(state.hintLevel) : 0;
      const requestId = `hint-${generation}-${nextLevel}`;
      activeRequestId = requestId;
      engine.setCurrentGameNodeId(input.gameNodeId);

      let positionAnalysis = null;
      try {
        positionAnalysis = await engine.analyze({
          requestId,
          gameNodeId: input.gameNodeId,
          fen: input.fen,
          priority: "user",
          multipv: 2,
          movetimeMs: defaultMovetimeMs,
        });
      } catch {
        positionAnalysis = null;
      }
      if (disposed || activeRequestId !== requestId) return null;

      const hint = buildHintStep({
        fen: input.fen,
        sideToMove: input.sideToMove ?? "w",
        positionAnalysis,
        level: nextLevel,
      });
      refreshAnnotations({
        hint,
        hintLevel: nextLevel,
        phase: "ready",
        insightDismissed: false,
      });
      activeRequestId = null;
      return hint;
    },

    resetHints() {
      refreshAnnotations({ hint: null, hintLevel: 0 });
    },

    clearFeedback() {
      this.cancelPending();
      const phase =
        state.phase === "analyzing" || state.phase === "ready"
          ? "ready"
          : state.phase;
      setState({
        phase,
        evidence: null,
        insight: null,
        insightDismissed: false,
        hint: null,
        hintLevel: 0,
        annotations: EMPTY_ANNOTATIONS,
        message: phase === "ready" ? null : state.message,
      });
    },

    cancelPending() {
      if (engine) {
        if (activeRequestId) {
          engine.cancel(`${activeRequestId}-before`);
          engine.cancel(`${activeRequestId}-after`);
          engine.cancel(activeRequestId);
        }
        engine.cancelAll();
      }
      activeRequestId = null;
      if (state.phase === "analyzing") {
        setState({
          phase: engine ? "ready" : "idle",
          message: null,
        });
      }
    },

    async dispose() {
      disposed = true;
      generation += 1;
      const disposeGen = generation;
      startPromise = null;
      this.cancelPending();
      const current = engine;
      engine = null;
      if (current) {
        await Promise.allSettled([current.dispose()]);
      }
      if (disposed && disposeGen === generation) {
        insightByNodeId.clear();
        futureByNodeId.clear();
        state = { ...IDLE };
        emit();
      }
    },
  };

  return controller;
}

function resolveDefaultEngine(): StockfishClientLike {
  if (typeof window !== "undefined") {
    if (typeof window.__chessgatorCreateAnalysisEngine === "function") {
      return window.__chessgatorCreateAnalysisEngine();
    }
    const stub = new URLSearchParams(window.location.search).get("e2eStub");
    if (stub === "1" || stub === "fallback" || stub === "coach") {
      return createStubAnalysisEngine();
    }
  }
  return new StockfishClient({ defaultMovetimeMs: 180 });
}
