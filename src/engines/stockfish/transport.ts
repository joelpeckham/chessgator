import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import { isStockfishWorkerResponse } from "@/engines/stockfish/protocol";

/**
 * Narrow transport so Node unit tests never touch `Worker` / browser globals.
 * Production uses `createBrowserWorkerTransport`.
 */
export type StockfishTransport = {
  postMessage(message: StockfishWorkerRequest): void;
  subscribe(listener: (message: StockfishWorkerResponse) => void): () => void;
  terminate(): void;
};

export type WorkerLike = {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  terminate(): void;
};

export function createBrowserWorkerTransport(worker: WorkerLike): StockfishTransport {
  const listeners = new Set<(message: StockfishWorkerResponse) => void>();

  const onMessage = (event: MessageEvent<unknown>) => {
    if (!isStockfishWorkerResponse(event.data)) return;
    for (const listener of listeners) listener(event.data);
  };

  worker.addEventListener("message", onMessage);

  return {
    postMessage(message) {
      worker.postMessage(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    terminate() {
      worker.removeEventListener("message", onMessage);
      listeners.clear();
      worker.terminate();
    },
  };
}

/** Create the default Next/bundler worker pointing at our typed entry. */
export function createStockfishWorker(): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Stockfish requires a browser Worker environment");
  }
  return new Worker(new URL("../../workers/stockfish-worker.ts", import.meta.url), {
    type: "module",
  });
}

export function createDefaultStockfishTransport(): StockfishTransport {
  return createBrowserWorkerTransport(createStockfishWorker());
}
