import { getLegalMoves } from "@/domain/game";
import type {
  ChooseMaiaMoveInput,
  MaiaMoveResult,
  MaiaSession,
  MaiaSessionState,
} from "@/features/game/maia-session";

export type StubMaiaSessionOptions = {
  /** When true, `start` rejects and phase becomes `failed`. */
  failInit?: boolean;
  /** Optional fixed UCI replies in order; falls back to first legal move. */
  scriptedMoves?: string[];
  initDelayMs?: number;
  moveDelayMs?: number;
};

/**
 * Deterministic Maia session for Playwright / unit tests.
 * Never touches workers or network.
 */
export function createStubMaiaSession(
  options: StubMaiaSessionOptions = {},
): MaiaSession {
  const failInit = options.failInit ?? false;
  const scriptedMoves = options.scriptedMoves ?? [];
  const initDelayMs = options.initDelayMs ?? 0;
  const moveDelayMs = options.moveDelayMs ?? 0;

  const listeners = new Set<() => void>();
  let scriptIndex = 0;
  let pendingRequestId: string | null = null;
  const cancelled = new Set<string>();
  let state: MaiaSessionState = { phase: "idle", message: null };
  let startPromise: Promise<boolean> | null = null;

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
      if (state.phase === "ready") return true;
      if (startPromise) return startPromise;

      startPromise = (async () => {
        setState({
          phase: "starting",
          message: "Downloading Maia model…",
        });
        if (initDelayMs > 0) {
          await delay(initDelayMs / 2);
        }
        setState({ message: "Initializing Maia…" });
        if (initDelayMs > 0) {
          await delay(initDelayMs / 2);
        }
        if (failInit) {
          setState({
            phase: "failed",
            message: "Stub Maia failed to initialize",
          });
          return false;
        }
        setState({ phase: "ready", message: "Maia ready" });
        return true;
      })().finally(() => {
        startPromise = null;
      });

      return startPromise;
    },

    async whenReady() {
      if (state.phase === "ready") return true;
      if (state.phase === "failed") return false;
      return session.start();
    },

    async chooseMove(
      input: ChooseMaiaMoveInput,
    ): Promise<MaiaMoveResult | null> {
      if (
        state.phase === "idle" ||
        state.phase === "starting" ||
        state.phase === "failed"
      ) {
        const ready = await session.whenReady();
        if (!ready || state.phase === "failed") {
          return null;
        }
      }

      pendingRequestId = input.requestId;
      setState({ phase: "thinking", message: "Maia thinking…" });

      if (moveDelayMs > 0) {
        await delay(moveDelayMs);
      }

      if (
        pendingRequestId !== input.requestId ||
        cancelled.has(input.requestId)
      ) {
        cancelled.delete(input.requestId);
        if (pendingRequestId === input.requestId) {
          pendingRequestId = null;
        }
        return null;
      }

      const scripted = scriptedMoves[scriptIndex];
      let moveUci = scripted;
      if (moveUci) {
        scriptIndex += 1;
      } else {
        const legal = getLegalMoves(input.fen);
        if (legal.length === 0) {
          setState({
            phase: "failed",
            message: `No legal moves for ${input.fen}`,
          });
          pendingRequestId = null;
          return null;
        }
        moveUci = legal[0]!.uci;
      }

      pendingRequestId = null;
      setState({ phase: "ready", message: "Maia ready" });
      return {
        requestId: input.requestId,
        gameNodeId: input.gameNodeId,
        moveUci,
      };
    },

    cancelPending() {
      if (pendingRequestId) {
        cancelled.add(pendingRequestId);
      }
      pendingRequestId = null;
      if (state.phase === "thinking") {
        setState({ phase: "ready", message: "Maia ready" });
      }
    },

    async dispose() {
      startPromise = null;
      session.cancelPending();
      cancelled.clear();
      state = { phase: "idle", message: null };
      emit();
    },
  };

  return session;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
