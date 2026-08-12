import {
  createBrowserWorkerTransport as createSharedBrowserWorkerTransport,
  type WorkerLike,
  type WorkerTransport,
} from "@/engines/shared/worker-transport";
import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import { isStockfishWorkerResponse } from "@/engines/stockfish/protocol";

export type { WorkerLike };

/**
 * Narrow transport so Node unit tests never touch `Worker` / browser globals.
 * Production uses `createBrowserWorkerTransport`.
 */
export type StockfishTransport = WorkerTransport<
  StockfishWorkerRequest,
  StockfishWorkerResponse
>;

export function createBrowserWorkerTransport(
  worker: WorkerLike,
): StockfishTransport {
  return createSharedBrowserWorkerTransport(worker, isStockfishWorkerResponse);
}

/** Create the default Next/bundler worker pointing at our typed entry. */
export function createStockfishWorker(): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Stockfish requires a browser Worker environment");
  }
  return new Worker(
    new URL("../../workers/stockfish-worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
}

export function createDefaultStockfishTransport(): StockfishTransport {
  return createBrowserWorkerTransport(createStockfishWorker());
}
