/**
 * Typed Maia worker entry.
 * Loads onnxruntime-web ONLY here (never on the main thread), runs the pinned
 * Maia3 5M fp16 browser export, and speaks `src/engines/maia/protocol.ts`.
 */
import * as ort from "onnxruntime-web";
import { validateLegalUci } from "@/domain/game/rules";
import {
  eloTensors,
  encodeTokensForBrowserExport,
  fromVocabUci,
} from "@/engines/maia/encode";
import { applyLegalMask, legalMovesMask } from "@/engines/maia/mask";
import type {
  MaiaInferRequest,
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import {
  argmax,
  sampleFromLogits,
  stableSoftmax,
  topKFromLogits,
} from "@/engines/maia/sample";
import { indexToMove } from "@/engines/maia/vocabulary";

type WorkerScope = {
  postMessage: (message: MaiaWorkerResponse) => void;
  onmessage: ((event: MessageEvent<MaiaWorkerRequest>) => void) | null;
  navigator?: Navigator;
};

const workerScope = self as unknown as WorkerScope;

let session: ort.InferenceSession | null = null;
let executionProvider: "webgpu" | "wasm" | null = null;
let initInFlight: string | null = null;
let activeRequestId: string | null = null;
let cancelRequested = false;

function post(message: MaiaWorkerResponse): void {
  workerScope.postMessage(message);
}

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

async function handleInit(
  requestId: string,
  modelUrl: string,
  wasmPaths: string,
): Promise<void> {
  if (session && executionProvider) {
    post({ type: "ready", requestId, executionProvider });
    return;
  }
  if (initInFlight) {
    const started = Date.now();
    while (!session && Date.now() - started < 120_000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    if (session && executionProvider) {
      post({ type: "ready", requestId, executionProvider });
      return;
    }
    post({
      type: "error",
      requestId,
      message: "Maia init already in progress",
    });
    return;
  }

  initInFlight = requestId;
  try {
    post({ type: "status", requestId, phase: "downloading" });
    // Fetch first so status reflects download vs session create.
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`Failed to download model: HTTP ${response.status}`);
    }
    const modelBytes = new Uint8Array(await response.arrayBuffer());

    post({ type: "status", requestId, phase: "initializing" });
    const created = await createSession(modelBytes, wasmPaths);
    session = created.session;
    executionProvider = created.provider;
    initInFlight = null;
    post({
      type: "ready",
      requestId,
      executionProvider: created.provider,
    });
  } catch (err) {
    initInFlight = null;
    session = null;
    executionProvider = null;
    post({
      type: "status",
      requestId,
      phase: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    post({
      type: "error",
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleInfer(request: MaiaInferRequest): Promise<void> {
  if (!session) {
    post({
      type: "error",
      requestId: request.requestId,
      message: "Maia is not ready",
    });
    return;
  }
  if (activeRequestId) {
    post({
      type: "error",
      requestId: request.requestId,
      message: "Maia is busy; queue on the main thread",
    });
    return;
  }

  activeRequestId = request.requestId;
  cancelRequested = false;

  try {
    const { tokens, dims } = encodeTokensForBrowserExport(
      request.fen,
      request.historyFens,
    );
    const { eloSelf, eloOppo } = eloTensors(request.selfElo, request.oppoElo);

    const feeds: Record<string, ort.Tensor> = {
      tokens: new ort.Tensor("float32", tokens, dims),
      elo_self: new ort.Tensor("float32", eloSelf, [1]),
      elo_oppo: new ort.Tensor("float32", eloOppo, [1]),
    };

    const output = await session.run(feeds);

    if (cancelRequested || activeRequestId !== request.requestId) {
      activeRequestId = null;
      cancelRequested = false;
      post({ type: "cancelled", requestId: request.requestId });
      return;
    }

    const moveTensor = output.logits_move ?? output["logits_move"];
    if (!moveTensor) {
      throw new Error("Model output missing logits_move");
    }
    const logits = moveTensor.data as Float32Array;

    const mask = legalMovesMask(request.fen);
    const masked = applyLegalMask(logits, mask);

    const chosenIdx = sampleFromLogits(masked, {
      temperature: request.temperature,
      topP: request.topP,
    });

    const vocabUci = indexToMove(chosenIdx);
    if (!vocabUci) {
      throw new Error(`Invalid move index from sampler: ${chosenIdx}`);
    }
    const boardUci = fromVocabUci(request.fen, vocabUci);
    const moveUci = validateLegalUci(request.fen, boardUci);
    if (!moveUci) {
      // Never emit an illegal move — fall back to argmax over remaining legal.
      const fallbackIdx = argmax(masked);
      const fallbackVocab = indexToMove(fallbackIdx);
      const fallbackBoard = fallbackVocab
        ? fromVocabUci(request.fen, fallbackVocab)
        : null;
      const legal = validateLegalUci(request.fen, fallbackBoard);
      if (!legal) {
        throw new Error(`Maia produced no legal move for ${request.fen}`);
      }
      const top = topKFromLogits(masked, 5).flatMap((c) => {
        const v = indexToMove(c.index);
        if (!v) return [];
        const u = validateLegalUci(request.fen, fromVocabUci(request.fen, v));
        if (!u) return [];
        return [{ moveUci: u, probability: c.probability }];
      });
      activeRequestId = null;
      post({
        type: "result",
        requestId: request.requestId,
        gameNodeId: request.gameNodeId,
        moveUci: legal,
        candidates: top,
        value: readValue(output),
      });
      return;
    }

    const candidates = topKFromLogits(masked, 5).flatMap((c) => {
      const v = indexToMove(c.index);
      if (!v) return [];
      const u = validateLegalUci(request.fen, fromVocabUci(request.fen, v));
      if (!u) return [];
      return [{ moveUci: u, probability: c.probability }];
    });

    activeRequestId = null;
    post({
      type: "result",
      requestId: request.requestId,
      gameNodeId: request.gameNodeId,
      moveUci,
      candidates,
      value: readValue(output),
    });
  } catch (err) {
    activeRequestId = null;
    cancelRequested = false;
    post({
      type: "error",
      requestId: request.requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function readValue(
  output: ort.InferenceSession.OnnxValueMapType,
): { loss: number; draw: number; win: number } | undefined {
  const valueTensor = output.logits_value ?? output["logits_value"];
  if (!valueTensor) return undefined;
  const data = valueTensor.data as Float32Array;
  if (data.length < 3) return undefined;
  const probs = stableSoftmax([data[0]!, data[1]!, data[2]!]);
  return { loss: probs[0]!, draw: probs[1]!, win: probs[2]! };
}

function handleCancel(requestId: string): void {
  if (activeRequestId !== requestId) {
    post({ type: "cancelled", requestId });
    return;
  }
  cancelRequested = true;
}

async function handleDispose(requestId: string): Promise<void> {
  try {
    if (session) {
      await session.release();
    }
  } catch {
    // ignore
  } finally {
    session = null;
    executionProvider = null;
    initInFlight = null;
    activeRequestId = null;
    cancelRequested = false;
    post({ type: "disposed", requestId });
  }
}

workerScope.onmessage = (event: MessageEvent<MaiaWorkerRequest>) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object" || !("type" in msg)) return;

  switch (msg.type) {
    case "init":
      void handleInit(msg.requestId, msg.modelUrl, msg.wasmPaths);
      break;
    case "infer":
      void handleInfer(msg);
      break;
    case "cancel":
      handleCancel(msg.requestId);
      break;
    case "dispose":
      void handleDispose(msg.requestId);
      break;
    default:
      break;
  }
};
