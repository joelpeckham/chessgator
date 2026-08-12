import { DEFAULT_POSITION } from "@/domain/game/rules";
import { describe, expect, it } from "vitest";
import { StockfishClient } from "@/engines/stockfish/client";
import { StockfishOpponent } from "@/engines/stockfish/opponent";
import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import type { StockfishTransport } from "@/engines/stockfish/transport";

function createTransport(bestMove: string): StockfishTransport {
  const listeners = new Set<(msg: StockfishWorkerResponse) => void>();
  return {
    postMessage(message: StockfishWorkerRequest) {
      if (message.type === "init") {
        queueMicrotask(() => {
          for (const l of listeners) l({ type: "ready", requestId: message.requestId });
        });
      }
      if (message.type === "analyze") {
        queueMicrotask(() => {
          for (const l of listeners) {
            l({
              type: "result",
              requestId: message.requestId,
              gameNodeId: message.gameNodeId,
              evidence: {
                requestId: message.requestId,
                gameNodeId: message.gameNodeId,
                fen: message.fen,
                sideToMove: "w",
                score: { cp: 15 },
                bestMoveUci: bestMove,
                lines: [
                  {
                    multipv: 1,
                    score: { cp: 15 },
                    pvUci: [bestMove],
                  },
                ],
              },
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
}

describe("StockfishOpponent", () => {
  it("returns a validated legal move behind OpponentEngine", async () => {
    const client = new StockfishClient({ transport: createTransport("e2e4") });
    const opponent = new StockfishOpponent({ client });
    await opponent.initialize();
    const result = await opponent.chooseMove({
      requestId: "m1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      movetimeMs: 40,
    });
    expect(result).toEqual({
      requestId: "m1",
      gameNodeId: "n1",
      moveUci: "e2e4",
      source: "stockfish",
    });
    await opponent.dispose();
  });

  it("rejects illegal engine output", async () => {
    const client = new StockfishClient({ transport: createTransport("e2e5") });
    const opponent = new StockfishOpponent({ client });
    await opponent.initialize();
    await expect(
      opponent.chooseMove({
        requestId: "m2",
        gameNodeId: "n1",
        fen: DEFAULT_POSITION,
      }),
    ).rejects.toThrow(/illegal/i);
    await opponent.dispose();
  });

  it("keeps browser Worker globals unused when a transport is injected", async () => {
    const hadWorker = "Worker" in globalThis;
    const client = new StockfishClient({ transport: createTransport("d2d4") });
    const opponent = new StockfishOpponent({ client });
    await opponent.initialize();
    await opponent.chooseMove({
      requestId: "m3",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
    });
    expect("Worker" in globalThis).toBe(hadWorker);
    await opponent.dispose();
  });
});
