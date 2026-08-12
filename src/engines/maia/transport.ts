import type {
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import { isMaiaWorkerResponse } from "@/engines/maia/protocol";

/**
 * Narrow transport so Node unit tests never touch `Worker` / browser globals.
 * Production uses `createBrowserWorkerTransport`.
 */
export type MaiaTransport = {
  postMessage(message: MaiaWorkerRequest): void;
  subscribe(listener: (message: MaiaWorkerResponse) => void): () => void;
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

export function createBrowserWorkerTransport(worker: WorkerLike): MaiaTransport {
  const listeners = new Set<(message: MaiaWorkerResponse) => void>();

  const onMessage = (event: MessageEvent<unknown>) => {
    if (!isMaiaWorkerResponse(event.data)) return;
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
