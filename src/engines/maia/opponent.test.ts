import { DEFAULT_POSITION } from "@/domain/game/rules";
import { describe, expect, it, vi } from "vitest";
import { MaiaClient } from "@/engines/maia/client";
import { MaiaOpponent } from "@/engines/maia/opponent";
import type {
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import type { MaiaTransport } from "@/engines/maia/transport";

function createFakeTransport(
  moveUci = "e2e4",
): {
  transport: MaiaTransport;
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
              type: "ready",
              requestId: message.requestId,
              executionProvider: "wasm",
            });
          }
        });
      }
      if (message.type === "infer") {
        queueMicrotask(() => {
          for (const l of listeners) {
            l({
              type: "result",
              requestId: message.requestId,
              gameNodeId: message.gameNodeId,
              moveUci,
              candidates: [{ moveUci, probability: 1 }],
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

  return { transport, sent };
}

describe("MaiaOpponent", () => {
  it("implements OpponentEngine and returns a legal Maia move", async () => {
    const { transport, sent } = createFakeTransport("e2e4");
    const client = new MaiaClient({ transport });
    const opponent = new MaiaOpponent({ client });

    await opponent.initialize();
    expect(opponent.status()).toBe("ready");
    expect(opponent.source).toBe("maia");

    const result = await opponent.chooseMove({
      requestId: "m1",
      gameNodeId: "g1",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
      temperature: 0,
      historyFens: [DEFAULT_POSITION],
    });

    expect(result).toEqual({
      requestId: "m1",
      gameNodeId: "g1",
      moveUci: "e2e4",
      source: "maia",
    });

    const infer = sent.find((m) => m.type === "infer");
    expect(infer && infer.type === "infer" && infer.historyFens).toEqual([
      DEFAULT_POSITION,
    ]);
  });

  it("rejects illegal engine output", async () => {
    const { transport } = createFakeTransport("e2e5");
    const opponent = new MaiaOpponent({
      client: new MaiaClient({ transport }),
    });
    await opponent.initialize();
    await expect(
      opponent.chooseMove({
        requestId: "bad",
        gameNodeId: "g1",
        fen: DEFAULT_POSITION,
      }),
    ).rejects.toThrow(/illegal/);
  });

  it("surfaces failed status when init fails", async () => {
    const listeners = new Set<(msg: MaiaWorkerResponse) => void>();
    const transport: MaiaTransport = {
      postMessage(message) {
        if (message.type === "init") {
          queueMicrotask(() => {
            for (const l of listeners) {
              l({
                type: "error",
                requestId: message.requestId,
                message: "boom",
              });
            }
          });
        }
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      terminate() {},
    };

    const opponent = new MaiaOpponent({
      client: new MaiaClient({ transport }),
    });
    await expect(opponent.initialize()).rejects.toThrow("boom");
    await vi.waitFor(() => {
      expect(opponent.status()).toBe("failed");
    });
  });
});
