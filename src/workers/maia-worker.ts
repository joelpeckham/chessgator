/**
 * Typed Maia worker entry.
 * Loads onnxruntime-web ONLY here (never on the main thread), runs the pinned
 * Maia3 5M fp16 browser export, and speaks `src/engines/maia/protocol.ts`.
 */
import * as ort from "onnxruntime-web";
import type {
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import { createMaiaWorkerRuntime } from "@/engines/maia/worker-runtime";

type WorkerScope = {
  postMessage: (message: MaiaWorkerResponse) => void;
  onmessage: ((event: MessageEvent<MaiaWorkerRequest>) => void) | null;
};

const workerScope = self as unknown as WorkerScope;

function supportsWebGpu(): boolean {
  try {
    const nav = navigator as Navigator & { gpu?: unknown };
    return typeof navigator !== "undefined" && !!nav.gpu;
  } catch {
    return false;
  }
}

async function createSession(
  modelBytes: Uint8Array,
  wasmPaths: string,
): Promise<{ session: ort.InferenceSession; provider: "webgpu" | "wasm" }> {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  if (wasmPaths) {
    ort.env.wasm.wasmPaths = wasmPaths.endsWith("/")
      ? wasmPaths
      : `${wasmPaths}/`;
  }

  const sessionOptions: ort.InferenceSession.SessionOptions = {
    graphOptimizationLevel: "basic",
  };

  if (supportsWebGpu()) {
    try {
      const webgpuSession = await ort.InferenceSession.create(modelBytes, {
        ...sessionOptions,
        executionProviders: ["webgpu"],
      });
      return { session: webgpuSession, provider: "webgpu" };
    } catch {
      // Fall through to WASM.
    }
  }

  const wasmSession = await ort.InferenceSession.create(modelBytes, {
    ...sessionOptions,
    executionProviders: ["wasm"],
  });
  return { session: wasmSession, provider: "wasm" };
}

const runtime = createMaiaWorkerRuntime({
  post: (message) => {
    workerScope.postMessage(message);
  },
  async loadModel(modelUrl, wasmPaths, report) {
    report("downloading");
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`Failed to download model: HTTP ${response.status}`);
    }
    const modelBytes = new Uint8Array(await response.arrayBuffer());
    report("initializing");
    const created = await createSession(modelBytes, wasmPaths);
    return {
      provider: created.provider,
      async run(feeds) {
        const output = await created.session.run({
          tokens: new ort.Tensor("float32", feeds.tokens, feeds.tokenDims),
          elo_self: new ort.Tensor("float32", feeds.eloSelf, [1]),
          elo_oppo: new ort.Tensor("float32", feeds.eloOppo, [1]),
        });
        const moveTensor = output.logits_move ?? output["logits_move"];
        if (!moveTensor) {
          throw new Error("Model output missing logits_move");
        }
        const valueTensor = output.logits_value ?? output["logits_value"];
        return {
          logitsMove: moveTensor.data as Float32Array,
          logitsValue: valueTensor
            ? (valueTensor.data as Float32Array)
            : undefined,
        };
      },
      async release() {
        await created.session.release();
      },
    };
  },
});

workerScope.onmessage = (event: MessageEvent<MaiaWorkerRequest>) => {
  runtime.handleRequest(event.data);
};
