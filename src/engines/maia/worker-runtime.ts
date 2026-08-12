import { validateLegalUci } from "@/domain/game/rules";
import {
  eloTensors,
  encodeTokensForBrowserExport,
  fromVocabUci,
} from "@/engines/maia/encode";
import { applyLegalMask, legalMovesMask } from "@/engines/maia/mask";
import type {
  MaiaInferRequest,
  MaiaStatusPhase,
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
import { createWaitUntilReady } from "@/engines/shared/wait-until-ready";

export type MaiaRunFeeds = {
  tokens: Float32Array;
  tokenDims: [number, number, number];
  eloSelf: Float32Array;
  eloOppo: Float32Array;
};

export type MaiaRunOutput = {
  logitsMove: ArrayLike<number>;
  logitsValue?: ArrayLike<number>;
};

export type MaiaLoadedModel = {
  provider: "webgpu" | "wasm";
  run: (feeds: MaiaRunFeeds) => Promise<MaiaRunOutput>;
  release: () => Promise<void>;
};

export type MaiaWorkerRuntimeDeps = {
  post: (message: MaiaWorkerResponse) => void;
  loadModel: (
    modelUrl: string,
    wasmPaths: string,
    report: (
      phase: Extract<MaiaStatusPhase, "downloading" | "initializing">,
    ) => void,
  ) => Promise<MaiaLoadedModel>;
  initTimeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type MaiaWorkerRuntime = {
  handleRequest: (msg: MaiaWorkerRequest) => void;
};

export function createMaiaWorkerRuntime(
  deps: MaiaWorkerRuntimeDeps,
): MaiaWorkerRuntime {
  const ready = createWaitUntilReady({
    timeoutMs: deps.initTimeoutMs ?? 120_000,
    timeoutMessage: "Maia init already in progress",
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer,
  });

  let model: MaiaLoadedModel | null = null;
  let initInFlight: string | null = null;
  let activeRequestId: string | null = null;
  let cancelRequested = false;

  async function handleInit(
    requestId: string,
    modelUrl: string,
    wasmPaths: string,
  ): Promise<void> {
    const alreadyReady = model;
    if (alreadyReady) {
      deps.post({
        type: "ready",
        requestId,
        executionProvider: alreadyReady.provider,
      });
      return;
    }
    if (initInFlight) {
      try {
        await ready.wait();
        const loaded = model;
        if (!loaded) {
          deps.post({
            type: "error",
            requestId,
            message: "Maia init already in progress",
          });
          return;
        }
        deps.post({
          type: "ready",
          requestId,
          executionProvider: loaded.provider,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        deps.post({
          type: "error",
          requestId,
          message,
        });
      }
      return;
    }

    initInFlight = requestId;
    try {
      const loaded = await deps.loadModel(modelUrl, wasmPaths, (phase) => {
        deps.post({ type: "status", requestId, phase });
      });
      model = loaded;
      initInFlight = null;
      ready.signalReady();
      deps.post({
        type: "ready",
        requestId,
        executionProvider: loaded.provider,
      });
    } catch (err) {
      initInFlight = null;
      model = null;
      const error = err instanceof Error ? err : new Error(String(err));
      ready.signalError(error);
      deps.post({
        type: "status",
        requestId,
        phase: "failed",
        detail: error.message,
      });
      deps.post({
        type: "error",
        requestId,
        message: error.message,
      });
    }
  }

  async function handleInfer(request: MaiaInferRequest): Promise<void> {
    if (!model) {
      deps.post({
        type: "error",
        requestId: request.requestId,
        message: "Maia is not ready",
      });
      return;
    }
    if (activeRequestId) {
      deps.post({
        type: "error",
        requestId: request.requestId,
        message: "Maia is busy; queue on the main thread",
      });
      return;
    }

    activeRequestId = request.requestId;
    cancelRequested = false;

    try {
      const { tokens, dims } = encodeTokensForBrowserExport(request.fen);
      const { eloSelf, eloOppo } = eloTensors(request.selfElo, request.oppoElo);
      const output = await model.run({
        tokens,
        tokenDims: dims,
        eloSelf,
        eloOppo,
      });

      if (cancelRequested || activeRequestId !== request.requestId) {
        activeRequestId = null;
        cancelRequested = false;
        deps.post({ type: "cancelled", requestId: request.requestId });
        return;
      }

      const logits = output.logitsMove;
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
      const value = readValue(output.logitsValue);

      if (!moveUci) {
        const fallbackIdx = argmax(masked);
        const fallbackVocab = indexToMove(fallbackIdx);
        const fallbackBoard = fallbackVocab
          ? fromVocabUci(request.fen, fallbackVocab)
          : null;
        const legal = validateLegalUci(request.fen, fallbackBoard);
        if (!legal) {
          throw new Error(`Maia produced no legal move for ${request.fen}`);
        }
        activeRequestId = null;
        deps.post({
          type: "result",
          requestId: request.requestId,
          gameNodeId: request.gameNodeId,
          moveUci: legal,
          candidates: topCandidates(masked, request.fen),
          value,
        });
        return;
      }

      activeRequestId = null;
      deps.post({
        type: "result",
        requestId: request.requestId,
        gameNodeId: request.gameNodeId,
        moveUci,
        candidates: topCandidates(masked, request.fen),
        value,
      });
    } catch (err) {
      activeRequestId = null;
      cancelRequested = false;
      deps.post({
        type: "error",
        requestId: request.requestId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function handleCancel(requestId: string): void {
    if (activeRequestId !== requestId) {
      deps.post({ type: "cancelled", requestId });
      return;
    }
    cancelRequested = true;
  }

  async function handleDispose(requestId: string): Promise<void> {
    try {
      if (model) {
        await model.release();
      }
    } catch {
      // ignore
    } finally {
      model = null;
      initInFlight = null;
      activeRequestId = null;
      cancelRequested = false;
      ready.reset();
      deps.post({ type: "disposed", requestId });
    }
  }

  return {
    handleRequest(msg) {
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
    },
  };
}

function topCandidates(
  masked: Float64Array,
  fen: string,
): Array<{ moveUci: string; probability: number }> {
  return topKFromLogits(masked, 5).flatMap((c) => {
    const v = indexToMove(c.index);
    if (!v) return [];
    const u = validateLegalUci(fen, fromVocabUci(fen, v));
    if (!u) return [];
    return [{ moveUci: u, probability: c.probability }];
  });
}

function readValue(
  logitsValue: ArrayLike<number> | undefined,
): { loss: number; draw: number; win: number } | undefined {
  if (!logitsValue || logitsValue.length < 3) return undefined;
  const probs = stableSoftmax([
    Number(logitsValue[0]),
    Number(logitsValue[1]),
    Number(logitsValue[2]),
  ]);
  return { loss: probs[0]!, draw: probs[1]!, win: probs[2]! };
}
