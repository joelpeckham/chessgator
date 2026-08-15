import { validateLegalUci } from "@/domain/game/rules";
import { MaiaClient } from "@/engines/maia/client";
import type { MaiaClientLike } from "@/engines/maia/ports";
import { markEnd, markStart } from "@/features/game/perf-marks";
import {
  createExternalStore,
  createStartGate,
} from "@/features/game/session-runtime";

export type { MaiaClientLike } from "@/engines/maia/ports";

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
  /** Resolves when phase is ready, or false if failed/disposed. */
  whenReady: () => Promise<boolean>;
  chooseMove: (input: ChooseMaiaMoveInput) => Promise<MaiaMoveResult | null>;
  cancelPending: () => void;
  dispose: () => Promise<void>;
};

export type CreateMaiaSessionOptions = {
  createClient?: () => MaiaClientLike;
};

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
  return createMaiaSessionFromClient(
    options.createClient ?? (() => new MaiaClient()),
  );
}

function createMaiaSessionFromClient(
  createClient: () => MaiaClientLike,
): MaiaSession {
  const store = createExternalStore<MaiaSessionState>({ ...IDLE_STATE });
  const gate = createStartGate();
  let client: MaiaClientLike | null = null;
  let pendingRequestId: string | null = null;

  const session: MaiaSession = {
    getState: store.getState,
    subscribe: store.subscribe,

    async start() {
      return gate.run(
        store.getState().phase === "ready" && Boolean(client) && !gate.disposed,
        async (startGen) => {
          const previousClient = client;
          if (previousClient) {
            try {
              await previousClient.dispose();
            } catch {
              // ignore previous client dispose errors
            }
            if (client === previousClient) {
              client = null;
            }
          }

          if (!gate.isCurrent(startGen)) return false;

          const currentClient = createClient();
          client = currentClient;
          markStart("engine-opponent-startup");

          store.setState({
            phase: "starting",
            message: "Downloading Maia model…",
          });

          const poll = windowSetInterval(() => {
            if (!gate.isCurrent(startGen) || client !== currentClient) {
              return;
            }
            const status = currentClient.status();
            if (status === "downloading") {
              store.setState({ message: "Downloading Maia model…" });
            } else if (status === "initializing") {
              store.setState({ message: "Initializing Maia…" });
            }
          }, 100);

          try {
            await currentClient.initialize();
            if (!gate.isCurrent(startGen) || client !== currentClient) {
              return false;
            }
            store.setState({
              phase: "ready",
              message: "Maia ready",
            });
            markEnd("engine-opponent-startup");
            return true;
          } catch (err) {
            if (!gate.isCurrent(startGen) || client !== currentClient) {
              return false;
            }
            const message =
              err instanceof Error ? err.message : "Maia failed to start";
            store.setState({
              phase: "failed",
              message,
            });
            markEnd("engine-opponent-startup");
            return false;
          } finally {
            windowClearInterval(poll);
          }
        },
      );
    },

    async whenReady() {
      const { phase } = store.getState();
      if (phase === "ready" || phase === "thinking") return true;
      if (phase === "failed") return false;
      return session.start();
    },

    async chooseMove(input) {
      const { phase } = store.getState();
      if (
        !client ||
        phase === "idle" ||
        phase === "starting" ||
        phase === "failed"
      ) {
        const ready = await session.whenReady();
        if (!ready || !client || store.getState().phase === "failed") {
          return null;
        }
      }

      const activeClient = client;
      if (!activeClient) return null;
      pendingRequestId = input.requestId;
      store.setState({ phase: "thinking", message: "Maia thinking…" });

      const attempt = async (): Promise<MaiaMoveResult> => {
        activeClient.setCurrentGameNodeId?.(input.gameNodeId);
        const result = await activeClient.infer({
          requestId: input.requestId,
          gameNodeId: input.gameNodeId,
          fen: input.fen,
          selfElo: input.selfElo,
          oppoElo: input.oppoElo,
          temperature: 0.8,
          topP: 0.9,
          timeoutMs: input.movetimeMs ? input.movetimeMs + 5_000 : undefined,
        });
        if (pendingRequestId !== input.requestId) {
          throw new Error("Maia move superseded");
        }
        const moveUci = validateLegalUci(input.fen, result.moveUci);
        if (!moveUci) {
          throw new Error(
            `Maia returned an illegal or missing move for ${input.fen}: ${result.moveUci}`,
          );
        }
        return {
          requestId: input.requestId,
          gameNodeId: input.gameNodeId,
          moveUci,
        };
      };

      try {
        let result: MaiaMoveResult;
        try {
          result = await attempt();
        } catch {
          if (pendingRequestId !== input.requestId) return null;
          result = await attempt();
        }
        store.setState({
          phase: "ready",
          message: "Maia ready",
        });
        return result;
      } catch (err) {
        if (pendingRequestId !== input.requestId) return null;
        const message =
          err instanceof Error ? err.message : "Maia failed to move";
        store.setState({
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
      if (store.getState().phase === "thinking") {
        store.setState({
          phase: "ready",
          message: "Maia ready",
        });
      }
    },

    async dispose() {
      const disposeGen = gate.beginDispose();
      session.cancelPending();
      const current = client;
      client = null;
      if (current) {
        await Promise.allSettled([current.dispose()]);
      }
      if (gate.isDisposeCurrent(disposeGen)) {
        store.replace({ ...IDLE_STATE });
      }
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
