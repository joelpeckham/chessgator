/**
 * Typed Stockfish worker entry.
 * Loads the versioned lite-single asset from /public/engine (never the package default)
 * and speaks the protocol in `src/engines/stockfish/protocol.ts`.
 */

import { stockfishAssetWorkerUrl } from "@/engines/stockfish/assets";
import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import { createStockfishWorkerRuntime } from "@/engines/stockfish/worker-runtime";

type WorkerScope = {
  postMessage: (message: StockfishWorkerResponse) => void;
  onmessage: ((event: MessageEvent<StockfishWorkerRequest>) => void) | null;
};

const workerScope = self as unknown as WorkerScope;

const runtime = createStockfishWorkerRuntime({
  post: (message) => {
    workerScope.postMessage(message);
  },
  createEngine(engineUrl, onLine, onError) {
    const url = engineUrl || stockfishAssetWorkerUrl();
    const nested = new Worker(url);
    nested.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data !== "string") return;
      for (const line of data.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        onLine(trimmed);
      }
    };
    nested.onerror = (event) => {
      onError(event.message);
    };
    return {
      postMessage: (command) => {
        nested.postMessage(command);
      },
      terminate: () => {
        nested.terminate();
      },
    };
  },
});

workerScope.onmessage = (event: MessageEvent<StockfishWorkerRequest>) => {
  runtime.handleRequest(event.data);
};
