import { DEFAULT_POSITION } from "@/domain/game/rules";
import { describe, expect, it, vi } from "vitest";
import { MaiaClient } from "@/engines/maia/client";
import type {
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import type { MaiaTransport } from "@/engines/maia/transport";

function createFakeTransport(): {
  transport: MaiaTransport;
  emit: (msg: MaiaWorkerResponse) => void;
  sent: MaiaWorkerRequest[];
} {
  const listeners = new Set<(msg: MaiaWorkerResponse) => void>();
  const sent: MaiaWorkerRequest[] = [];

  const transport: MaiaTransport = {
    postMessage(message) {
      sent.push(message);
      if (message.type === "init") {
        queueMicrotask(() => {
          for (const l of listeners) {
            l({
              type: "status",
              requestId: message.requestId,
              phase: "downloading",
            });
            l({
              type: "status",
              requestId: message.requestId,
              phase: "initializing",
            });
            l({
              type: "ready",
              requestId: message.requestId,
              executionProvider: "wasm",
            });
          }
        });
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

describe("MaiaClient", () => {
  it("tracks downloading → initializing → ready", async () => {
    const { transport } = createFakeTransport();
    const client = new MaiaClient({ transport });
    expect(client.status()).toBe("idle");
    const init = client.initialize();
    await vi.waitFor(() => {
      expect(["downloading", "initializing", "ready"]).toContain(client.status());
    });
    await init;
    expect(client.status()).toBe("ready");
    expect(client.getExecutionProvider()).toBe("wasm");
  });

  it("ignores stale results for a non-current game node", async () => {
    const { transport, emit, sent } = createFakeTransport();
    const client = new MaiaClient({ transport, timeoutBufferMs: 5_000 });
    await client.initialize();
    client.setCurrentGameNodeId("node-current");

    const promise = client.infer({
      requestId: "r1",
      gameNodeId: "node-stale",
      fen: DEFAULT_POSITION,
    });

    await vi.waitFor(() => {
      expect(sent.some((m) => m.type === "infer" && m.requestId === "r1")).toBe(
        true,
      );
    });

    emit({
      type: "result",
      requestId: "r1",
      gameNodeId: "node-stale",
      moveUci: "e2e4",
      candidates: [{ moveUci: "e2e4", probability: 1 }],
    });

    await expect(promise).rejects.toThrow(/Stale inference/);
  });

  it("times out a hung inference", async () => {
    const { transport } = createFakeTransport();
    let now = 0;
    const timers: Array<{ at: number; fn: () => void }> = [];
    const client = new MaiaClient({
      transport,
      now: () => now,
      setTimer: (fn, ms) => {
        const handle = { at: now + ms, fn };
        timers.push(handle);
        return handle;
      },
      clearTimer: (handle) => {
        const idx = timers.indexOf(handle as (typeof timers)[number]);
        if (idx >= 0) timers.splice(idx, 1);
      },
    });
    await client.initialize();

    const promise = client.infer({
      requestId: "slow",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      timeoutMs: 50,
    });

    now = 50;
    for (const t of [...timers]) {
      if (t.at <= now) t.fn();
    }

    await expect(promise).rejects.toThrow(/timed out/);
  });

  it("rejects cancelled requests", async () => {
    const { transport, sent } = createFakeTransport();
    const client = new MaiaClient({ transport, timeoutBufferMs: 5_000 });
    await client.initialize();

    const promise = client.infer({
      requestId: "c1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
    });

    await vi.waitFor(() => {
      expect(sent.some((m) => m.type === "infer")).toBe(true);
    });

    client.cancel("c1");
    await expect(promise).rejects.toThrow(/cancelled/);
  });
});
