import {
  buildMoveAnalysisEvidence,
  evidenceToSummary,
  type MoveAnalysisEvidence,
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
import {
  createAnalysisEngine,
  type AnalysisEngine,
  type CreateAnalysisEngineFn,
} from "@/features/game/analysis-engine";
import { markEnd, markStart } from "@/features/game/perf-marks";

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
  cardExpanded: boolean;
  showLine: boolean;
  hintLevel: HintLevel;
  hint: HintStep | null;
  annotations: BoardAnnotation;
};

export type AnalyzePlayerMoveInput = {
  requestId: string;
  gameNodeId: string;
  fenBefore: string;
  fenAfter: string;
  playedMove: GameMove;
  maiaPredictedLikelihood?: number;
  movetimeMs?: number;
};

export type CoachingController = {
  getState: () => CoachingControllerState;
  subscribe: (listener: () => void) => () => void;
  start: () => Promise<boolean>;
  analyzePlayerMove: (
    input: AnalyzePlayerMoveInput,
  ) => Promise<MoveAnalysisEvidence | null>;
  escalateHint: (input: {
    fen: string;
    gameNodeId: string;
    sideToMove?: "w" | "b";
  }) => Promise<HintStep | null>;
  resetHints: () => void;
  setShowLine: (show: boolean) => void;
  setCardExpanded: (expanded: boolean) => void;
  clearFeedback: () => void;
  cancelPending: () => void;
  dispose: () => Promise<void>;
};

export type CreateCoachingControllerOptions = {
  createEngine?: CreateAnalysisEngineFn;
  defaultMovetimeMs?: number;
};

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
  cardExpanded: false,
  showLine: false,
  hintLevel: 0,
  hint: null,
  annotations: EMPTY_ANNOTATIONS,
};

/**
 * Owns Stockfish-backed move analysis + hint ladder for the coaching slice.
 * Ignores stale/cancelled results via request ids and current game-node id.
 */
export function createCoachingController(
  options: CreateCoachingControllerOptions = {},
): CoachingController {
  const createEngine = options.createEngine ?? createAnalysisEngine;
  const defaultMovetimeMs = options.defaultMovetimeMs ?? 180;
  const listeners = new Set<() => void>();

  let engine: AnalysisEngine | null = null;
  let disposed = false;
  let activeRequestId: string | null = null;
  let generation = 0;
  let state: CoachingControllerState = { ...IDLE };

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function setState(partial: Partial<CoachingControllerState>): void {
    state = { ...state, ...partial };
    emit();
  }

  function annotationsFromInsight(
    insight: TeachingInsight | null,
    evidence: MoveAnalysisEvidence | null,
    showLine: boolean,
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

    if (showLine && insight) {
      const line = insight.lineUci.length
        ? insight.lineUci
        : insight.suggestedMoveUci
          ? [insight.suggestedMoveUci]
          : [];
      for (const uci of line) {
        if (uci.length < 4) continue;
        arrows.push({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          color: "var(--foreground)",
        });
        highlightSquares.add(uci.slice(0, 2));
        highlightSquares.add(uci.slice(2, 4));
      }
      if (line[0] && line[0].length >= 4) {
        labels.push({ square: line[0].slice(2, 4), text: "line" });
      }
    } else if (insight?.suggestedMoveUci && insight.autoExpand && evidence) {
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
      next.showLine,
      next.hint,
    );
    setState({ ...partial, annotations });
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      // Always allow restart: React Strict Mode dispose() must not permanently
      // block the same useState-held controller instance.
      await this.dispose();
      disposed = false;
      generation += 1;
      const startGen = generation;
      engine = createEngine();
      markStart("engine-coach-startup");
      setState({
        ...IDLE,
        phase: "starting",
        message: "Starting coach analysis…",
      });
      try {
        await engine.initialize();
        if (disposed || startGen !== generation) return false;
        setState({
          phase: "ready",
          message: "Coach ready",
        });
        markEnd("engine-coach-startup");
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Coach analysis failed";
        setState({ phase: "failed", message });
        markEnd("engine-coach-startup");
        return false;
      }
    },

    async analyzePlayerMove(input) {
      if (!engine || state.phase === "failed" || state.phase === "idle") {
        return null;
      }

      this.cancelPending();
      activeRequestId = input.requestId;
      const gen = generation;
      engine.setCurrentGameNodeId(input.gameNodeId);
      markStart("analysis-player-move");
      // Clear prior teaching evidence so Explore / card never act on a stale move.
      setState({
        phase: "analyzing",
        message: "Analyzing your move…",
        evidence: null,
        insight: null,
        cardExpanded: false,
        hint: null,
        hintLevel: 0,
        showLine: false,
        annotations: EMPTY_ANNOTATIONS,
      });

      const movetimeMs = input.movetimeMs ?? defaultMovetimeMs;
      const beforeId = `${input.requestId}-before`;
      const afterId = `${input.requestId}-after`;

      const isStale = () =>
        disposed ||
        gen !== generation ||
        activeRequestId !== input.requestId;

      /** Leave analyzing when this request dies without a successor owning the phase. */
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
          maiaPredictedLikelihood: input.maiaPredictedLikelihood,
        });
        const insight = selectTeachingInsight(evidence);

        refreshAnnotations({
          phase: "ready",
          message: null,
          evidence,
          insight,
          cardExpanded: insight.autoExpand,
          showLine: false,
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
        // Soft-fail: keep playing; coaching is optional for continuity.
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

    async escalateHint(input) {
      if (!engine || state.phase === "failed" || state.phase === "idle") {
        return null;
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
      });
      activeRequestId = null;
      return hint;
    },

    resetHints() {
      refreshAnnotations({ hint: null, hintLevel: 0 });
    },

    setShowLine(show) {
      refreshAnnotations({ showLine: show });
    },

    setCardExpanded(expanded) {
      setState({ cardExpanded: expanded });
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
        cardExpanded: false,
        showLine: false,
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
      // Never leave the coach stuck analyzing after cancel (timeline jump, etc.).
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
      this.cancelPending();
      const current = engine;
      engine = null;
      if (current) {
        await current.dispose();
      }
      state = { ...IDLE };
      emit();
    },
  };
}

/** Re-export for callers that attach summaries to the tree. */
export { evidenceToSummary };
