import { validateLegalUci } from "@/domain/game/rules";
import {
  MaiaClient,
  type MaiaClientStatus,
  type MaiaInferResult,
} from "@/engines/maia/client";
import { markEnd, markStart } from "@/features/game/perf-marks";
import { createStubMaiaSession } from "@/features/game/stub-maia";

export type MaiaSessionPhase =
  | "idle"
  | "starting"
  | "ready"
  | "thinking"
  | "failed";

export type MaiaSessionState = {
  phase: MaiaSessionPhase;
  message: string | null;
};

export type ChooseMaiaMoveInput = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  selfElo: number;
  oppoElo: number;
  movetimeMs?: number;
};

export type MaiaMoveResult = {
  requestId: string;
  gameNodeId: string;
  moveUci: string;
};

export type MaiaSession = {
  getState: () => MaiaSessionState;
  subscribe: (listener: () => void) => () => void;
  start: () => Promise<boolean>;
  chooseMove: (input: ChooseMaiaMoveInput) => Promise<MaiaMoveResult | null>;
  cancelPending: () => void;
  dispose: () => Promise<void>;
};

/** Minimal surface of MaiaClient needed by the session (for tests). */
export type MaiaClientLike = {
  status: () => MaiaClientStatus;
  initialize: () => Promise<void>;
  infer: (options: {
    requestId: string;
    gameNodeId: string;
    fen: string;
    selfElo?: number;
    oppoElo?: number;
    temperature?: number;
    topP?: number;
    timeoutMs?: number;
  }) => Promise<Pick<MaiaInferResult, "requestId" | "gameNodeId" | "moveUci">>;
  cancel: (requestId: string) => void;
  dispose: () => Promise<void>;
  setCurrentGameNodeId?: (gameNodeId: string | null) => void;
};

export type CreateMaiaSessionOptions = {
  createClient?: () => MaiaClientLike;
};

export type CreateMaiaSessionFn = (
  options?: CreateMaiaSessionOptions,
) => MaiaSession;

declare global {
  interface Window {
    __chessgatorCreateMaiaSession?: CreateMaiaSessionFn;
  }
}

const IDLE_STATE: MaiaSessionState = {
  phase: "idle",
  message: null,
};

/**
 * Thin lifecycle around MaiaClient for the playable slice.
 * No Stockfish fallback — start/chooseMove failures surface as `failed`.
 */
export function createMaiaSession(
  options: CreateMaiaSessionOptions = {},
): MaiaSession {
  if (options.createClient) {
    return createMaiaSessionFromClient(options.createClient);
  }

  if (typeof window !== "undefined") {
    if (typeof window.__chessgatorCreateMaiaSession === "function") {
      return window.__chessgatorCreateMaiaSession();
    }

    const stub = new URLSearchParams(window.location.search).get("e2eStub");
    if (stub === "1" || stub === "coach") {
      return createStubMaiaSession({
        initDelayMs: 40,
        moveDelayMs: 20,
        scriptedMoves: stub === "coach" ? ["e7e5"] : undefined,
      });
    }
  }

  return createMaiaSessionFromClient(() => new MaiaClient());
}

function createMaiaSessionFromClient(
  createClient: () => MaiaClientLike,
): MaiaSession {
  const listeners = new Set<() => void>();

  let client: MaiaClientLike | null = null;
  let pendingRequestId: string | null = null;
  let disposed = false;
  let state: MaiaSessionState = { ...IDLE_STATE };

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function setState(partial: Partial<MaiaSessionState>): void {
    state = { ...state, ...partial };
    emit();
  }

  const session: MaiaSession = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      // Always allow restart: React Strict Mode dispose() must not permanently
      // block the same useState-held session instance.
      await session.dispose();
      disposed = false;
      client = createClient();
      markStart("engine-opponent-startup");

      setState({
        phase: "starting",
        message: "Downloading Maia model…",
      });

      const poll = windowSetInterval(() => {
        if (!client) return;
        const status = client.status();
        if (status === "downloading") {
          setState({ message: "Downloading Maia model…" });
        } else if (status === "initializing") {
          setState({ message: "Initializing Maia…" });
        }
      }, 100);

      try {
        await client.initialize();
        if (disposed) return false;
        setState({
          phase: "ready",
          message: "Maia ready",
        });
        markEnd("engine-opponent-startup");
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Maia failed to start";
        setState({
          phase: "failed",
          message,
        });
        markEnd("engine-opponent-startup");
        return false;
      } finally {
        windowClearInterval(poll);
      }
    },

    async chooseMove(input) {
      if (!client || state.phase === "failed" || state.phase === "idle") {
        return null;
      }

      pendingRequestId = input.requestId;
      setState({ phase: "thinking", message: "Maia thinking…" });

      try {
        client.setCurrentGameNodeId?.(input.gameNodeId);
        const result = await client.infer({
          requestId: input.requestId,
          gameNodeId: input.gameNodeId,
          fen: input.fen,
          selfElo: input.selfElo,
          oppoElo: input.oppoElo,
          temperature: 0.8,
          topP: 0.9,
          timeoutMs: input.movetimeMs
            ? input.movetimeMs + 5_000
            : undefined,
        });

        if (pendingRequestId !== input.requestId) return null;

        const moveUci = validateLegalUci(input.fen, result.moveUci);
        if (!moveUci) {
          setState({
            phase: "failed",
            message: `Maia returned an illegal or missing move for ${input.fen}: ${result.moveUci}`,
          });
          return null;
        }

        setState({
          phase: "ready",
          message: "Maia ready",
        });
        return {
          requestId: input.requestId,
          gameNodeId: input.gameNodeId,
          moveUci,
        };
      } catch (err) {
        if (pendingRequestId !== input.requestId) return null;
        const message =
          err instanceof Error ? err.message : "Maia failed to move";
        setState({
          phase: "failed",
          message,
        });
        return null;
      } finally {
        if (pendingRequestId === input.requestId) {
          pendingRequestId = null;
        }
      }
    },

    cancelPending() {
      if (pendingRequestId && client) {
        client.cancel(pendingRequestId);
      }
      pendingRequestId = null;
      if (state.phase === "thinking") {
        setState({
          phase: "ready",
          message: "Maia ready",
        });
      }
    },

    async dispose() {
      disposed = true;
      session.cancelPending();
      const current = client;
      client = null;
      if (current) {
        await Promise.allSettled([current.dispose()]);
      }
      state = { ...IDLE_STATE };
      emit();
    },
  };

  return session;
}

function windowSetInterval(
  fn: () => void,
  ms: number,
): ReturnType<typeof setInterval> | null {
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
