import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION, getLegalMoves } from "@/domain/game";
import type { MaiaClientStatus } from "@/engines/maia/client";
import {
  createMaiaSession,
  type MaiaClientLike,
} from "@/features/game/maia-session";

function createFakeClient(
  options: {
    failInit?: boolean;
    initDelayMs?: number;
    moveDelayMs?: number;
    failInfer?: boolean;
    failInferTimes?: number;
    scriptedMoves?: string[];
  } = {},
): MaiaClientLike {
  let statusValue: MaiaClientStatus = "idle";
  let scriptIndex = 0;
  const cancelled = new Set<string>();
  const scriptedMoves = options.scriptedMoves ?? [];

  return {
    status: () => statusValue,
    async initialize() {
      if (statusValue === "ready") return;
      statusValue = "downloading";
      if (options.initDelayMs) {
        await delay(options.initDelayMs / 2);
      }
      statusValue = "initializing";
      if (options.initDelayMs) {
        await delay(options.initDelayMs / 2);
      }
      if (options.failInit) {
        statusValue = "failed";
        throw new Error("Stub Maia failed to initialize");
      }
      statusValue = "ready";
    },
    async infer(input) {
      if (statusValue !== "ready") {
        throw new Error("Maia is not ready");
      }
      if (options.moveDelayMs) {
        await delay(options.moveDelayMs);
      }
      if (cancelled.has(input.requestId)) {
        cancelled.delete(input.requestId);
        throw new Error(`Cancelled ${input.requestId}`);
      }
      if (options.failInfer) {
        throw new Error("inference crashed");
      }
      if (options.failInferTimes && options.failInferTimes > 0) {
        options.failInferTimes -= 1;
        throw new Error("inference crashed");
      }
      const scripted = scriptedMoves[scriptIndex];
      let moveUci = scripted;
      if (moveUci) {
        scriptIndex += 1;
      } else {
        const legal = getLegalMoves(input.fen);
        if (legal.length === 0) {
          throw new Error(`No legal moves for ${input.fen}`);
        }
        moveUci = legal[0]!.uci;
      }
      return {
        requestId: input.requestId,
        gameNodeId: input.gameNodeId,
        moveUci,
      };
    },
    cancel(requestId) {
      cancelled.add(requestId);
    },
    async dispose() {
      statusValue = "disposed";
    },
    setCurrentGameNodeId() {},
  };
}

describe("maia session", () => {
  it("starts successfully when Maia init succeeds", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient({ initDelayMs: 10 }),
    });

    const ok = await session.start();
    expect(ok).toBe(true);
    expect(session.getState().phase).toBe("ready");
    expect(session.getState().message).toBe("Maia ready");
    await session.dispose();
  });

  it("fails start without Stockfish fallback when Maia init fails", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient({ failInit: true }),
    });

    const ok = await session.start();
    expect(ok).toBe(false);
    expect(session.getState().phase).toBe("failed");
    expect(session.getState().message).toMatch(/failed to initialize/i);
    await session.dispose();
  });

  it("ignores stale chooseMove results after cancel", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient({ moveDelayMs: 40 }),
    });
    await session.start();

    const pending = session.chooseMove({
      requestId: "r1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });
    session.cancelPending();
    const result = await pending;
    expect(result).toBeNull();
    await session.dispose();
  });

  it("returns a legal UCI move for the requested FEN", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient(),
    });
    await session.start();

    const result = await session.chooseMove({
      requestId: "r2",
      gameNodeId: "n2",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });
    expect(result).not.toBeNull();
    const legal = new Set(getLegalMoves(DEFAULT_POSITION).map((m) => m.uci));
    expect(legal.has(result!.moveUci)).toBe(true);
    await session.dispose();
  });

  it("sets failed and returns null when chooseMove inference fails", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient({ failInfer: true }),
    });
    await session.start();

    const result = await session.chooseMove({
      requestId: "r3",
      gameNodeId: "n3",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });

    expect(result).toBeNull();
    expect(session.getState().phase).toBe("failed");
    expect(session.getState().message).toMatch(/inference crashed/i);
    await session.dispose();
  });

  it("retries a transient inference failure once", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient({ failInferTimes: 1 }),
    });
    await session.start();

    const result = await session.chooseMove({
      requestId: "r3-retry",
      gameNodeId: "n3",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });

    expect(result).not.toBeNull();
    expect(session.getState().phase).toBe("ready");
    await session.dispose();
  });

  it("ignores a superseded init failure after Strict Mode cleanup", async () => {
    let rejectStale!: (error: Error) => void;
    const staleInit = new Promise<void>((_resolve, reject) => {
      rejectStale = reject;
    });
    const staleClient = createFakeClient();
    staleClient.initialize = () => staleInit;
    let createCount = 0;
    const session = createMaiaSession({
      createClient: () => {
        createCount += 1;
        return createCount === 1 ? staleClient : createFakeClient();
      },
    });

    const staleStart = session.start();
    await session.dispose();
    await expect(session.start()).resolves.toBe(true);

    rejectStale(new Error("Maia init timed out"));
    await expect(staleStart).resolves.toBe(false);
    expect(session.getState()).toMatchObject({
      phase: "ready",
      message: "Maia ready",
    });
    await session.dispose();
  });

  it("start succeeds after dispose (Strict Mode cleanup)", async () => {
    const session = createMaiaSession({
      createClient: () => createFakeClient({ initDelayMs: 5 }),
    });

    await session.dispose();
    const ok = await session.start();
    expect(ok).toBe(true);
    expect(session.getState().phase).toBe("ready");
    await session.dispose();
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
