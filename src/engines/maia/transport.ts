import type {
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import { isMaiaWorkerResponse } from "@/engines/maia/protocol";
import {
  createBrowserWorkerTransport as createSharedBrowserWorkerTransport,
  type WorkerLike,
  type WorkerTransport,
} from "@/engines/shared/worker-transport";

export type { WorkerLike };

/**
 * Narrow transport so Node unit tests never touch `Worker` / browser globals.
 * Production uses `createBrowserWorkerTransport`.
 */
export type MaiaTransport = WorkerTransport<MaiaWorkerRequest, MaiaWorkerResponse>;

export function createBrowserWorkerTransport(worker: WorkerLike): MaiaTransport {
  return createSharedBrowserWorkerTransport(worker, isMaiaWorkerResponse);
}

/** Create the default Next/bundler worker pointing at our typed entry. */
export function createMaiaWorker(): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Maia requires a browser Worker environment");
  }
  return new Worker(new URL("../../workers/maia-worker.ts", import.meta.url), {
    type: "module",
  });
}

export function createDefaultMaiaTransport(): MaiaTransport {
  return createBrowserWorkerTransport(createMaiaWorker());
}
