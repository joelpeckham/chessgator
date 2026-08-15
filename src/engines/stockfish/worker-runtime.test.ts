import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "@/domain/game/rules";
import type { StockfishWorkerResponse } from "@/engines/stockfish/protocol";
import { createStockfishWorkerRuntime } from "@/engines/stockfish/worker-runtime";

function createHarness() {
  const posted: StockfishWorkerResponse[] = [];
  const commands: string[] = [];
  let terminated = false;
  let onError: ((message: string) => void) | null = null;
  const runtime = createStockfishWorkerRuntime({
    post: (message) => {
      posted.push(message);
    },
    createEngine(_url, _onLine, errorCb) {
      onError = errorCb;
      return {
        postMessage(command) {
          commands.push(command);
        },
        terminate() {
          terminated = true;
        },
      };
    },
  });
  return {
    runtime,
    posted,
    commands,
    isTerminated: () => terminated,
    triggerError: (message: string) => {
      onError?.(message);
    },
  };
}

async function readyEngine() {
  const harness = createHarness();
  harness.runtime.handleRequest({
    type: "init",
    requestId: "init-1",
    engineUrl: "/engine.js",
  });
  harness.runtime.handleEngineLine("uciok");
  harness.runtime.handleEngineLine("readyok");
  await Promise.resolve();
  return harness;
}

describe("createStockfishWorkerRuntime", () => {
  it("completes init from uciok/readyok without polling", async () => {
    const { runtime, posted, commands } = createHarness();
    runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      engineUrl: "/engine.js",
    });
    expect(commands).toContain("uci");
    runtime.handleEngineLine("uciok");
    expect(commands).toContain("isready");
    runtime.handleEngineLine("readyok");
    expect(posted).toEqual([{ type: "ready", requestId: "init-1" }]);
  });

  it("lets a second init wait on the ready promise", async () => {
    const { runtime, posted } = createHarness();
    runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      engineUrl: "/engine.js",
    });
    runtime.handleRequest({
      type: "init",
      requestId: "init-2",
      engineUrl: "/engine.js",
    });
    runtime.handleEngineLine("uciok");
    runtime.handleEngineLine("readyok");
    await Promise.resolve();
    await Promise.resolve();
    expect(posted).toEqual([
      { type: "ready", requestId: "init-1" },
      { type: "ready", requestId: "init-2" },
    ]);
  });

  it("returns MultiPV evidence on bestmove", async () => {
    const { runtime, posted, commands } = await readyEngine();
    runtime.handleRequest({
      type: "analyze",
      requestId: "a1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      multipv: 1,
      movetimeMs: 50,
    });
    expect(commands.some((c) => c.startsWith("position fen"))).toBe(true);
    runtime.handleEngineLine(
      "info depth 8 seldepth 12 multipv 1 score cp 24 nodes 100 time 20 pv e2e4 e7e5",
    );
    runtime.handleEngineLine("bestmove e2e4 ponder e7e5");
    const result = posted.find((m) => m.type === "result");
    expect(result?.type).toBe("result");
    if (result?.type !== "result") return;
    expect(result.evidence.bestMoveUci).toBe("e2e4");
    expect(result.evidence.ponderUci).toBe("e7e5");
    expect(result.evidence.score).toEqual({ cp: 24 });
  });

  it("stops an in-flight search on cancel", async () => {
    const { runtime, posted, commands } = await readyEngine();
    runtime.handleRequest({
      type: "analyze",
      requestId: "a1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      multipv: 1,
      movetimeMs: 50,
    });
    runtime.handleRequest({ type: "cancel", requestId: "a1" });
    expect(commands).toContain("stop");
    runtime.handleEngineLine("bestmove e2e4");
    expect(
      posted.some((m) => m.type === "cancelled" && m.requestId === "a1"),
    ).toBe(true);
  });

  it("clears a failed nested-engine load so a later init can succeed", async () => {
    const harness = createHarness();
    harness.runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      engineUrl: "/engine.js",
    });
    harness.triggerError("asset 404");
    await Promise.resolve();
    expect(harness.posted).toEqual([
      {
        type: "error",
        requestId: "init-1",
        message: "Stockfish worker error: asset 404",
      },
    ]);
    expect(harness.isTerminated()).toBe(true);

    harness.runtime.handleRequest({
      type: "init",
      requestId: "init-2",
      engineUrl: "/engine.js",
    });
    harness.runtime.handleEngineLine("uciok");
    harness.runtime.handleEngineLine("readyok");
    expect(harness.posted.at(-1)).toEqual({
      type: "ready",
      requestId: "init-2",
    });
  });

  it("disposes the nested engine", async () => {
    const harness = await readyEngine();
    harness.runtime.handleRequest({ type: "dispose", requestId: "d1" });
    expect(harness.isTerminated()).toBe(true);
    expect(harness.posted.at(-1)).toEqual({
      type: "disposed",
      requestId: "d1",
    });
  });
});
