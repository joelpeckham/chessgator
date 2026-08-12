import { DEFAULT_POSITION } from "@/domain/game/rules";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { describe, expect, it, vi } from "vitest";
import { StockfishClient } from "@/engines/stockfish/client";
import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import type { StockfishTransport } from "@/engines/stockfish/transport";

function makeEvidence(
  requestId: string,
  gameNodeId: string,
  bestMoveUci = "e2e4",
): AnalysisEvidence {
  return {
    requestId,
    gameNodeId,
    fen: DEFAULT_POSITION,
    sideToMove: "w",
    score: { cp: 20 },
    bestMoveUci,
    lines: [
      {
        multipv: 1,
        score: { cp: 20 },
        pvUci: [bestMoveUci],
      },
    ],
  };
}

function createFakeTransport(options?: {
  onAnalyze?: (req: Extract<StockfishWorkerRequest, { type: "analyze" }>) => void;
}): {
  transport: StockfishTransport;
  emit: (msg: StockfishWorkerResponse) => void;
  sent: StockfishWorkerRequest[];
} {
  const listeners = new Set<(msg: StockfishWorkerResponse) => void>();
  const sent: StockfishWorkerRequest[] = [];

  const transport: StockfishTransport = {
    postMessage(message) {
      sent.push(message);
      if (message.type === "init") {
        queueMicrotask(() => {
          for (const l of listeners) {
            l({ type: "ready", requestId: message.requestId });
          }
        });
      }
      if (message.type === "analyze") {
        options?.onAnalyze?.(message);
      }
      if (message.type === "dispose") {
        queueMicrotask(() => {
          for (const l of listeners) {
            l({ type: "disposed", requestId: message.requestId });
          }
        });
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    terminate() {
      listeners.clear();
    },
  };

  return {
    transport,
    sent,
    emit(msg) {
      for (const l of listeners) l(msg);
    },
  };
}

describe("StockfishClient", () => {
  it("queues user work ahead of background while busy", async () => {
    const { transport, emit, sent } = createFakeTransport();
    const client = new StockfishClient({ transport, timeoutBufferMs: 5_000 });
    await client.initialize();

    const first = client.analyze({
      requestId: "r1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      priority: "background",
      movetimeMs: 50,
    });

    await vi.waitFor(() => {
      expect(sent.some((m) => m.type === "analyze" && m.requestId === "r1")).toBe(
        true,
      );
    });

    const second = client.analyze({
      requestId: "r2",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      priority: "user",
      movetimeMs: 50,
    });
    const third = client.analyze({
      requestId: "r3",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      priority: "background",
      movetimeMs: 50,
    });

    expect(client.queuedRequestIds()).toEqual(["r2", "r3"]);

    emit({
      type: "result",
      requestId: "r1",
      gameNodeId: "n1",
      evidence: makeEvidence("r1", "n1"),
    });

    await vi.waitFor(() => {
      expect(sent.some((m) => m.type === "analyze" && m.requestId === "r2")).toBe(
        true,
      );
    });
    expect(client.queuedRequestIds()).toEqual(["r3"]);

    emit({
      type: "result",
      requestId: "r2",
      gameNodeId: "n1",
      evidence: makeEvidence("r2", "n1", "d2d4"),
    });
    await vi.waitFor(() => {
      expect(sent.some((m) => m.type === "analyze" && m.requestId === "r3")).toBe(
        true,
      );
    });
    emit({
      type: "result",
      requestId: "r3",
      gameNodeId: "n1",
      evidence: makeEvidence("r3", "n1", "c2c4"),
    });

    await expect(first).resolves.toMatchObject({ requestId: "r1" });
    await expect(second).resolves.toMatchObject({ requestId: "r2", bestMoveUci: "d2d4" });
    await expect(third).resolves.toMatchObject({ requestId: "r3" });
    await client.dispose();
  });

  it("cancels a queued job without contacting the worker analyze", async () => {
    const { transport, emit, sent } = createFakeTransport();
    const client = new StockfishClient({ transport });

    const running = client.analyze({
      requestId: "run",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      priority: "user",
      movetimeMs: 50,
    });
    const queued = client.analyze({
      requestId: "queued",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      priority: "background",
      movetimeMs: 50,
    });

    await vi.waitFor(() =>
      expect(sent.some((m) => m.type === "analyze" && m.requestId === "run")).toBe(
        true,
      ),
    );

    client.cancel("queued");
    await expect(queued).rejects.toThrow(/cancelled/);

    emit({
      type: "result",
      requestId: "run",
      gameNodeId: "n1",
      evidence: makeEvidence("run", "n1"),
    });
    await expect(running).resolves.toBeTruthy();
    expect(sent.some((m) => m.type === "analyze" && m.requestId === "queued")).toBe(
      false,
    );
    await client.dispose();
  });

  it("ignores stale results when the current game node changed", async () => {
    const { transport, emit, sent } = createFakeTransport();
    const client = new StockfishClient({ transport });
    client.setCurrentGameNodeId("node-a");

    const promise = client.analyze({
      requestId: "stale",
      gameNodeId: "node-a",
      fen: DEFAULT_POSITION,
      movetimeMs: 50,
    });

    await vi.waitFor(() =>
      expect(sent.some((m) => m.type === "analyze")).toBe(true),
    );

    client.setCurrentGameNodeId("node-b");
    emit({
      type: "result",
      requestId: "stale",
      gameNodeId: "node-a",
      evidence: makeEvidence("stale", "node-a"),
    });

    await expect(promise).rejects.toThrow(/Stale analysis/);
    await client.dispose();
  });

  it("times out and cancels the active search", async () => {
    let now = 0;
    const timers = new Map<number, { fn: () => void; due: number }>();
    let timerId = 1;

    const { transport, sent } = createFakeTransport();
    const client = new StockfishClient({
      transport,
      now: () => now,
      setTimer: (fn, ms) => {
        const id = timerId++;
        timers.set(id, { fn, due: now + ms });
        return id;
      },
      clearTimer: (handle) => {
        timers.delete(handle as number);
      },
      timeoutBufferMs: 10,
    });

    const promise = client.analyze({
      requestId: "slow",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      movetimeMs: 20,
      timeoutMs: 30,
    });

    await vi.waitFor(() =>
      expect(sent.some((m) => m.type === "analyze" && m.requestId === "slow")).toBe(
        true,
      ),
    );

    now = 30;
    for (const [id, timer] of [...timers.entries()]) {
      if (timer.due <= now) {
        timers.delete(id);
        timer.fn();
      }
    }

    await expect(promise).rejects.toThrow(/timed out/);
    expect(sent.some((m) => m.type === "cancel" && m.requestId === "slow")).toBe(
      true,
    );
    await client.dispose();
  });

  it("drops late worker results after cancellation", async () => {
    const { transport, emit, sent } = createFakeTransport();
    const client = new StockfishClient({ transport });

    const promise = client.analyze({
      requestId: "c1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      movetimeMs: 50,
    });

    await vi.waitFor(() =>
      expect(sent.some((m) => m.type === "analyze")).toBe(true),
    );

    client.cancel("c1");
    expect(sent.some((m) => m.type === "cancel" && m.requestId === "c1")).toBe(true);

    // Worker eventually answers — client must not resolve successfully.
    emit({
      type: "result",
      requestId: "c1",
      gameNodeId: "n1",
      evidence: makeEvidence("c1", "n1"),
    });

    await expect(promise).rejects.toThrow(/cancelled/);
    await client.dispose();
  });
});
