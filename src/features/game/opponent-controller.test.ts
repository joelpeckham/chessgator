import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION, getLegalMoves } from "@/domain/game";
import { createOpponentController } from "@/features/game/opponent-controller";
import { StubOpponent } from "@/features/game/stub-opponent";

describe("opponent controller", () => {
  it("starts Maia as the active source when primary init succeeds", async () => {
    const controller = createOpponentController({
      createPair: () => ({
        primary: new StubOpponent({ source: "maia", initDelayMs: 10 }),
        fallback: new StubOpponent({ source: "stockfish" }),
      }),
    });

    const ok = await controller.start();
    expect(ok).toBe(true);
    expect(controller.getState().activeSource).toBe("maia");
    expect(controller.getState().phase).toBe("ready");
    expect(controller.getState().fallbackReason).toBeNull();
    await controller.dispose();
  });

  it("falls back to Stockfish when Maia init fails and explains it", async () => {
    const controller = createOpponentController({
      createPair: () => ({
        primary: new StubOpponent({ source: "maia", failInit: true }),
        fallback: new StubOpponent({ source: "stockfish", initDelayMs: 10 }),
      }),
    });

    const ok = await controller.start();
    expect(ok).toBe(true);
    expect(controller.getState().activeSource).toBe("stockfish");
    expect(controller.getState().fallbackReason).toMatch(/Maia unavailable/i);
    await controller.dispose();
  });

  it("ignores stale chooseMove results after cancel", async () => {
    const controller = createOpponentController({
      createPair: () => ({
        primary: new StubOpponent({
          source: "maia",
          moveDelayMs: 40,
        }),
        fallback: new StubOpponent({ source: "stockfish" }),
      }),
    });
    await controller.start();

    const pending = controller.chooseMove({
      requestId: "r1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });
    controller.cancelPending();
    const result = await pending;
    expect(result).toBeNull();
    await controller.dispose();
  });

  it("returns a legal UCI move for the requested FEN", async () => {
    const controller = createOpponentController({
      createPair: () => ({
        primary: new StubOpponent({ source: "maia" }),
        fallback: new StubOpponent({ source: "stockfish" }),
      }),
    });
    await controller.start();

    const result = await controller.chooseMove({
      requestId: "r2",
      gameNodeId: "n2",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });
    expect(result).not.toBeNull();
    const legal = new Set(getLegalMoves(DEFAULT_POSITION).map((m) => m.uci));
    expect(legal.has(result!.moveUci)).toBe(true);
    await controller.dispose();
  });

  it("switches to Stockfish when Maia move selection fails mid-game", async () => {
    const flaky = new StubOpponent({ source: "maia" });
    const original = flaky.chooseMove.bind(flaky);
    let calls = 0;
    flaky.chooseMove = async (request) => {
      calls += 1;
      if (calls === 1) {
        throw new Error("inference crashed");
      }
      return original(request);
    };

    const controller = createOpponentController({
      createPair: () => ({
        primary: flaky,
        fallback: new StubOpponent({ source: "stockfish" }),
      }),
    });
    await controller.start();

    const result = await controller.chooseMove({
      requestId: "r3",
      gameNodeId: "n3",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
    });

    expect(result?.source).toBe("stockfish");
    expect(controller.getState().activeSource).toBe("stockfish");
    expect(controller.getState().fallbackReason).toMatch(/Maia move failed/i);
    await controller.dispose();
  });

  it("start succeeds after dispose (Strict Mode cleanup)", async () => {
    const controller = createOpponentController({
      createPair: () => ({
        primary: new StubOpponent({ source: "maia", initDelayMs: 5 }),
        fallback: new StubOpponent({ source: "stockfish" }),
      }),
    });

    await controller.dispose();
    const ok = await controller.start();
    expect(ok).toBe(true);
    expect(controller.getState().phase).toBe("ready");
    expect(controller.getState().activeSource).toBe("maia");
    await controller.dispose();
  });
});
