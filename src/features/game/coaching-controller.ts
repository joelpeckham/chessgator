import {
  buildMoveAnalysisEvidence,
  type MoveAnalysisEvidence,
} from "@/domain/analysis";
import type { GameMove } from "@/domain/game";
import {
  annotationsFromInsight,
  buildHintStep,
  EMPTY_BOARD_ANNOTATIONS,
  type HintLevel,
  type HintStep,
  nextHintLevel,
  type SemanticBoardAnnotation,
  selectTeachingInsight,
  type TeachingInsight,
} from "@/domain/teaching";
import { StockfishClient } from "@/engines/stockfish";
import type {
  CreateAnalysisEngineFn,
  StockfishClientLike,
} from "@/engines/stockfish/ports";
import { markEnd, markStart } from "@/features/game/perf-marks";
import {
  createExternalStore,
  createStartGate,
} from "@/features/game/session-runtime";

export type CoachingPhase =
  | "idle"
  | "starting"
  | "ready"
  | "analyzing"
  | "failed";

export type BoardAnnotation = SemanticBoardAnnotation;

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
};

export type AnalyzePlayerMoveInput = {
  requestId: string;
  gameNodeId: string;
  fenBefore: string;
  fenAfter: string;
  playedMove: GameMove;
  previousMove?: GameMove | null;
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
  getCachedInsight: (gameNodeId: string) => TeachingInsight | null;
  dismissInsight: () => void;
  showInsight: (gameNodeId?: string | null) => void;
  escalateHint: (input: {
    fen: string;
    gameNodeId: string;
    sideToMove: "w" | "b";
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

const EMPTY_ANNOTATIONS: BoardAnnotation = EMPTY_BOARD_ANNOTATIONS;

const IDLE: CoachingControllerState = {
  phase: "idle",
  message: null,
  evidence: null,
  insight: null,
  hintLevel: 0,
  hint: null,
  annotations: EMPTY_ANNOTATIONS,
  insightDismissed: false,
};

/**
 * Owns Stockfish-backed move analysis + hint ladder for the coaching slice.
 * Ignores stale/cancelled results via request ids and current game-node id.
 */
export function createCoachingController(
  options: CreateCoachingControllerOptions = {},
): CoachingController {
  const createEngine =
    options.createEngine ??
    (() => new StockfishClient({ defaultMovetimeMs: 180 }));
  const defaultMovetimeMs = options.defaultMovetimeMs ?? 180;
  const store = createExternalStore<CoachingControllerState>({ ...IDLE });
  const gate = createStartGate();

  let engine: StockfishClientLike | null = null;
  let activeRequestId: string | null = null;
  const insightByNodeId = new Map<string, TeachingInsight>();

  function setState(partial: Partial<CoachingControllerState>): void {
    store.setState(partial);
  }

  function refreshAnnotations(
    partial: Partial<CoachingControllerState> = {},
  ): void {
    const next = { ...store.getState(), ...partial };
    const annotations = annotationsFromInsight(
      next.insight,
      next.evidence,
      next.hint,
    );
    setState({ ...partial, annotations });
  }

  const controller: CoachingController = {
    getState: store.getState,
    subscribe: store.subscribe,

    async start() {
      const { phase } = store.getState();
      return gate.run(
        (phase === "ready" || phase === "analyzing") &&
          Boolean(engine) &&
          !gate.disposed,
        async (startGen) => {
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

          if (!gate.isCurrent(startGen)) return false;

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
            if (!gate.isCurrent(startGen) || engine !== currentEngine) {
              return false;
            }
            setState({
              phase: "ready",
              message: "Coach ready",
            });
            markEnd("engine-coach-startup");
            return true;
          } catch (err) {
            if (!gate.isCurrent(startGen) || engine !== currentEngine) {
              return false;
            }
            const message =
              err instanceof Error ? err.message : "Coach analysis failed";
            setState({ phase: "failed", message });
            markEnd("engine-coach-startup");
            return false;
          }
        },
      );
    },

    async whenReady() {
      // Analyzing means the engine is already up — never restart mid-request.
      const { phase } = store.getState();
      if (phase === "ready" || phase === "analyzing") return true;
      if (phase === "failed") return false;
      if (gate.startPromise) return gate.startPromise;
      return controller.start();
    },

    async analyzePlayerMove(input) {
      const { phase } = store.getState();
      if (
        !engine ||
        phase === "idle" ||
        phase === "starting" ||
        phase === "failed"
      ) {
        const ready = await controller.whenReady();
        if (!ready || !engine || store.getState().phase === "failed") {
          return null;
        }
      }

      this.cancelPending();
      activeRequestId = input.requestId;
      const gen = gate.generation;
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
        !gate.isCurrent(gen) || activeRequestId !== input.requestId;

      const leaveAnalyzingIfOrphaned = () => {
        if (
          gate.isCurrent(gen) &&
          activeRequestId === null &&
          store.getState().phase === "analyzing"
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
          previousMove: input.previousMove ?? null,
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
        const message = err instanceof Error ? err.message : "Analysis failed";
        setState({
          phase: "ready",
          message:
            message.includes("cancelled") || message.includes("Stale")
              ? null
              : message,
        });
        activeRequestId = null;
        markEnd("analysis-player-move");
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
      const { phase } = store.getState();
      if (
        !engine ||
        phase === "idle" ||
        phase === "starting" ||
        phase === "failed"
      ) {
        const ready = await controller.whenReady();
        if (!ready || !engine || store.getState().phase === "failed") {
          return null;
        }
      }
      const current = store.getState();
      const nextLevel = current.hint ? nextHintLevel(current.hintLevel) : 0;
      const requestId = `hint-${gate.generation}-${nextLevel}`;
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
      if (gate.disposed || activeRequestId !== requestId) return null;

      const built = buildHintStep({
        fen: input.fen,
        sideToMove: input.sideToMove,
        positionAnalysis,
        level: nextLevel,
      });
      refreshAnnotations({
        hint: built,
        hintLevel: nextLevel,
        phase: "ready",
        insightDismissed: false,
      });
      activeRequestId = null;
      return built;
    },

    resetHints() {
      refreshAnnotations({ hint: null, hintLevel: 0 });
    },

    clearFeedback() {
      this.cancelPending();
      const current = store.getState();
      const phase =
        current.phase === "analyzing" || current.phase === "ready"
          ? "ready"
          : current.phase;
      setState({
        phase,
        evidence: null,
        insight: null,
        insightDismissed: false,
        hint: null,
        hintLevel: 0,
        annotations: EMPTY_ANNOTATIONS,
        message: phase === "ready" ? null : current.message,
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
      if (store.getState().phase === "analyzing") {
        setState({
          phase: engine ? "ready" : "idle",
          message: null,
        });
      }
    },

    async dispose() {
      const disposeGen = gate.beginDispose();
      this.cancelPending();
      const current = engine;
      engine = null;
      if (current) {
        await Promise.allSettled([current.dispose()]);
      }
      if (gate.isDisposeCurrent(disposeGen)) {
        insightByNodeId.clear();
        store.replace({ ...IDLE });
      }
    },
  };

  return controller;
}
