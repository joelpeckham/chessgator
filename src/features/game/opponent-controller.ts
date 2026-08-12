import type {
  OpponentEngine,
  OpponentEngineStatus,
  OpponentMoveResult,
} from "@/engines/shared/opponent";
import {
  createOpponents,
  type OpponentPair,
} from "@/features/game/create-opponents";
import { markEnd, markStart } from "@/features/game/perf-marks";

export type OpponentUiPhase =
  | "idle"
  | "starting"
  | "ready"
  | "thinking"
  | "failed";

export type OpponentControllerState = {
  phase: OpponentUiPhase;
  activeSource: "maia" | "stockfish" | null;
  primaryStatus: OpponentEngineStatus;
  fallbackStatus: OpponentEngineStatus;
  /** Human-readable progress / fallback explanation. */
  message: string | null;
  fallbackReason: string | null;
};

export type ChooseOpponentMoveInput = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  historyFens?: string[];
  selfElo: number;
  oppoElo: number;
  movetimeMs?: number;
};

export type OpponentController = {
  getState: () => OpponentControllerState;
  subscribe: (listener: () => void) => () => void;
  start: () => Promise<boolean>;
  chooseMove: (
    input: ChooseOpponentMoveInput,
  ) => Promise<OpponentMoveResult | null>;
  cancelPending: () => void;
  dispose: () => Promise<void>;
};

export type CreateOpponentControllerOptions = {
  createPair?: () => OpponentPair;
  now?: () => number;
};

const IDLE_STATE: OpponentControllerState = {
  phase: "idle",
  activeSource: null,
  primaryStatus: "idle",
  fallbackStatus: "idle",
  message: null,
  fallbackReason: null,
};

/**
 * Owns Maia primary + Stockfish fallback lifecycle for the playable slice.
 * Validates nothing about chess rules — callers must apply moves via domain commands.
 */
export function createOpponentController(
  options: CreateOpponentControllerOptions = {},
): OpponentController {
  const createPair = options.createPair ?? createOpponents;
  const listeners = new Set<() => void>();

  let pair: OpponentPair | null = null;
  let active: OpponentEngine | null = null;
  let pendingRequestId: string | null = null;
  let disposed = false;
  let state: OpponentControllerState = { ...IDLE_STATE };

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function setState( partial: Partial<OpponentControllerState>): void {
    state = { ...state, ...partial };
    emit();
  }

  function syncEngineStatuses(): void {
    setState({
      primaryStatus: pair?.primary.status() ?? "idle",
      fallbackStatus: pair?.fallback.status() ?? "idle",
    });
  }

  async function startPrimary(primary: OpponentEngine): Promise<void> {
    setState({
      phase: "starting",
      message: "Downloading Maia model…",
      fallbackReason: null,
      activeSource: null,
    });
    syncEngineStatuses();

    const poll = windowSetInterval(() => {
      const status = primary.status();
      if (status === "downloading") {
        setState({
          primaryStatus: status,
          message: "Downloading Maia model…",
        });
      } else if (status === "initializing") {
        setState({
          primaryStatus: status,
          message: "Initializing Maia…",
        });
      } else {
        setState({ primaryStatus: status });
      }
    }, 100);

    try {
      await primary.initialize();
    } finally {
      windowClearInterval(poll);
      syncEngineStatuses();
    }
  }

  async function startFallback(
    fallback: OpponentEngine,
    reason: string,
  ): Promise<void> {
    setState({
      phase: "starting",
      message: "Starting Stockfish fallback…",
      fallbackReason: reason,
      activeSource: null,
    });
    syncEngineStatuses();
    await fallback.initialize();
    syncEngineStatuses();
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
      pair = createPair();
      active = null;
      markStart("engine-opponent-startup");

      try {
        await startPrimary(pair.primary);
        if (disposed) return false;
        active = pair.primary;
        setState({
          phase: "ready",
          activeSource: "maia",
          message: "Maia ready",
          fallbackReason: null,
          primaryStatus: pair.primary.status(),
          fallbackStatus: pair.fallback.status(),
        });
        markEnd("engine-opponent-startup");
        return true;
      } catch (primaryError) {
        const reason =
          primaryError instanceof Error
            ? primaryError.message
            : "Maia failed to start";
        try {
          await startFallback(
            pair.fallback,
            `Maia unavailable (${reason}). Playing against Stockfish instead.`,
          );
          if (disposed) return false;
          active = pair.fallback;
          setState({
            phase: "ready",
            activeSource: "stockfish",
            message: "Using Stockfish fallback",
            fallbackReason: `Maia unavailable (${reason}). Playing against Stockfish instead.`,
            primaryStatus: pair.primary.status(),
            fallbackStatus: pair.fallback.status(),
          });
          markEnd("engine-opponent-startup");
          return true;
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : "Stockfish failed to start";
          setState({
            phase: "failed",
            activeSource: null,
            message: fallbackMessage,
            fallbackReason: `Maia unavailable (${reason}). Stockfish also failed: ${fallbackMessage}`,
            primaryStatus: pair.primary.status(),
            fallbackStatus: pair.fallback.status(),
          });
          markEnd("engine-opponent-startup");
          return false;
        }
      }
    },

    async chooseMove(input) {
      if (!active || state.phase === "failed" || state.phase === "idle") {
        return null;
      }

      pendingRequestId = input.requestId;
      setState({ phase: "thinking", message: "Opponent thinking…" });
      syncEngineStatuses();

      const tryEngine = async (
        engine: OpponentEngine,
      ): Promise<OpponentMoveResult> => {
        return engine.chooseMove({
          requestId: input.requestId,
          gameNodeId: input.gameNodeId,
          fen: input.fen,
          historyFens: input.historyFens,
          selfElo: input.selfElo,
          oppoElo: input.oppoElo,
          movetimeMs: input.movetimeMs,
          temperature: 0.8,
          topP: 0.9,
        });
      };

      try {
        const result = await tryEngine(active);
        if (pendingRequestId !== input.requestId) return null;
        setState({
          phase: "ready",
          message:
            state.activeSource === "stockfish"
              ? "Using Stockfish fallback"
              : "Maia ready",
        });
        syncEngineStatuses();
        return result;
      } catch (err) {
        if (pendingRequestId !== input.requestId) return null;

        // Mid-game Maia failure → one-shot Stockfish fallback for this move.
        if (
          active.source === "maia" &&
          pair &&
          pair.fallback.status() !== "disposed"
        ) {
          const reason =
            err instanceof Error ? err.message : "Maia move selection failed";
          try {
            if (pair.fallback.status() !== "ready") {
              await startFallback(
                pair.fallback,
                `Maia move failed (${reason}). Switching to Stockfish.`,
              );
            } else {
              setState({
                fallbackReason: `Maia move failed (${reason}). Switching to Stockfish.`,
              });
            }
            active = pair.fallback;
            setState({
              activeSource: "stockfish",
              message: "Using Stockfish fallback",
            });
            const result = await tryEngine(active);
            if (pendingRequestId !== input.requestId) return null;
            setState({ phase: "ready" });
            syncEngineStatuses();
            return result;
          } catch (fallbackErr) {
            if (pendingRequestId !== input.requestId) return null;
            const message =
              fallbackErr instanceof Error
                ? fallbackErr.message
                : "Opponent failed";
            setState({
              phase: "failed",
              message,
              fallbackReason: `Both opponents failed. Last error: ${message}`,
            });
            syncEngineStatuses();
            return null;
          }
        }

        const message = err instanceof Error ? err.message : "Opponent failed";
        setState({
          phase: "failed",
          message,
          fallbackReason: message,
        });
        syncEngineStatuses();
        return null;
      } finally {
        if (pendingRequestId === input.requestId) {
          pendingRequestId = null;
        }
      }
    },

    cancelPending() {
      if (pendingRequestId && active) {
        active.cancel(pendingRequestId);
      }
      pendingRequestId = null;
      if (state.phase === "thinking") {
        setState({
          phase: state.activeSource ? "ready" : state.phase,
          message:
            state.activeSource === "stockfish"
              ? "Using Stockfish fallback"
              : state.activeSource === "maia"
                ? "Maia ready"
                : state.message,
        });
      }
    },

    async dispose() {
      disposed = true;
      this.cancelPending();
      const current = pair;
      pair = null;
      active = null;
      if (current) {
        await Promise.allSettled([
          current.primary.dispose(),
          current.fallback.dispose(),
        ]);
      }
      state = { ...IDLE_STATE };
      emit();
    },
  };
}

function windowSetInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> | null {
  if (typeof setInterval === "undefined") return null;
  return setInterval(fn, ms);
}

function windowClearInterval(
  handle: ReturnType<typeof setInterval> | null,
): void {
  if (handle != null && typeof clearInterval !== "undefined") {
    clearInterval(handle);
  }
}
