import { pickPrimaryScore } from "@/domain/analysis/score";
import type {
  AnalysisEvidence,
  PrincipalVariation,
} from "@/domain/analysis/types";
import { tryApplyMove, validateLegalUci } from "@/domain/game/rules";
import {
  createWaitUntilReady,
  joinOrStartWorkerInit,
} from "@/engines/shared/wait-until-ready";
import { stockfishAssetWorkerUrl } from "@/engines/stockfish/assets";
import type {
  StockfishAnalyzeRequest,
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import {
  applyInfoLine,
  parseBestMove,
  parseInfoLine,
  sideToMoveFromFen,
  sortedLines,
} from "@/engines/stockfish/uci-parse";

export type NestedStockfishEngine = {
  postMessage: (command: string) => void;
  terminate: () => void;
};

export type StockfishWorkerRuntimeDeps = {
  post: (message: StockfishWorkerResponse) => void;
  createEngine: (
    url: string,
    onLine: (line: string) => void,
    onError: (message: string) => void,
  ) => NestedStockfishEngine;
  initTimeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type StockfishWorkerRuntime = {
  handleRequest: (msg: StockfishWorkerRequest) => void;
  handleEngineLine: (line: string) => void;
};

export function createStockfishWorkerRuntime(
  deps: StockfishWorkerRuntimeDeps,
): StockfishWorkerRuntime {
  const ready = createWaitUntilReady({
    timeoutMs: deps.initTimeoutMs ?? 30_000,
    timeoutMessage: "Stockfish init already in progress",
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer,
  });

  let engine: NestedStockfishEngine | null = null;
  let initInFlight: string | null = null;
  let activeAnalyze: StockfishAnalyzeRequest | null = null;
  let linesByMultipv = new Map<number, PrincipalVariation>();
  let cancelRequested = false;

  function sendUci(command: string): void {
    engine?.postMessage(command);
  }

  function resetSearchState(): void {
    linesByMultipv = new Map();
    cancelRequested = false;
  }

  function tearDownEngine(): void {
    if (!engine) return;
    try {
      engine.terminate();
    } catch {
      // ignore
    }
    engine = null;
  }

  function failNestedEngine(message: string): void {
    const error = new Error(`Stockfish worker error: ${message}`);
    const failingInit = initInFlight;
    const failingAnalyze = activeAnalyze;
    tearDownEngine();
    initInFlight = null;
    activeAnalyze = null;
    resetSearchState();
    if (failingInit) {
      ready.signalError(error);
    } else {
      ready.reset();
    }
    deps.post({
      type: "error",
      requestId: failingAnalyze?.requestId ?? failingInit ?? "engine",
      message: error.message,
    });
  }

  function ensureEngine(engineUrl: string): NestedStockfishEngine {
    if (engine) return engine;
    const url = engineUrl || stockfishAssetWorkerUrl();
    engine = deps.createEngine(
      url,
      (line) => handleEngineLine(line),
      (message) => {
        failNestedEngine(message);
      },
    );
    return engine;
  }

  async function handleInit(
    requestId: string,
    engineUrl: string,
  ): Promise<void> {
    const shouldStart = joinOrStartWorkerInit({
      isReady: ready.ready,
      initInFlight,
      wait: () => ready.wait(),
      onAlreadyReady: () => {
        deps.post({ type: "ready", requestId });
      },
      onJoinedReady: () => {
        deps.post({ type: "ready", requestId });
      },
      onJoinError: (message) => {
        deps.post({ type: "error", requestId, message });
      },
    });
    if (shouldStart !== true) return;

    try {
      initInFlight = requestId;
      ensureEngine(engineUrl);
      sendUci("uci");
    } catch (err) {
      initInFlight = null;
      const error = err instanceof Error ? err : new Error(String(err));
      ready.signalError(error);
      deps.post({
        type: "error",
        requestId,
        message: error.message,
      });
    }
  }

  function handleAnalyze(request: StockfishAnalyzeRequest): void {
    if (!engine || !ready.ready) {
      deps.post({
        type: "error",
        requestId: request.requestId,
        message: "Stockfish is not ready",
      });
      return;
    }
    if (activeAnalyze) {
      deps.post({
        type: "error",
        requestId: request.requestId,
        message: "Stockfish is busy; queue on the main thread",
      });
      return;
    }

    activeAnalyze = request;
    resetSearchState();

    const multipv = Math.max(1, Math.min(5, request.multipv | 0));
    const movetime = Math.max(16, request.movetimeMs | 0);

    sendUci("ucinewgame");
    sendUci(`setoption name MultiPV value ${multipv}`);
    sendUci(`position fen ${request.fen}`);
    sendUci(`go movetime ${movetime}`);
  }

  function handleCancel(requestId: string): void {
    if (!activeAnalyze || activeAnalyze.requestId !== requestId) {
      deps.post({ type: "cancelled", requestId });
      return;
    }
    cancelRequested = true;
    sendUci("stop");
  }

  function handleDispose(requestId: string): void {
    try {
      if (engine) {
        try {
          engine.postMessage("quit");
        } catch {
          // ignore
        }
        engine.terminate();
        engine = null;
      }
    } finally {
      initInFlight = null;
      activeAnalyze = null;
      resetSearchState();
      ready.reset();
      deps.post({ type: "disposed", requestId });
    }
  }

  function handleEngineLine(line: string): void {
    if (initInFlight) {
      if (line === "uciok") {
        sendUci("isready");
        return;
      }
      if (line === "readyok") {
        const requestId = initInFlight;
        initInFlight = null;
        ready.signalReady();
        deps.post({ type: "ready", requestId });
        return;
      }
    }

    if (!activeAnalyze) {
      return;
    }

    if (cancelRequested) {
      if (line.startsWith("bestmove")) {
        const requestId = activeAnalyze.requestId;
        activeAnalyze = null;
        resetSearchState();
        deps.post({ type: "cancelled", requestId });
      }
      return;
    }

    if (
      line === "readyok" ||
      line.startsWith("option ") ||
      line.startsWith("id ")
    ) {
      return;
    }

    const info = parseInfoLine(line);
    if (info) {
      const side = sideToMoveFromFen(activeAnalyze.fen);
      applyInfoLine(linesByMultipv, info, activeAnalyze.fen, side);
      return;
    }

    const best = parseBestMove(line);
    if (!best) return;

    const req = activeAnalyze;
    const side = sideToMoveFromFen(req.fen);
    const lines = sortedLines(linesByMultipv);
    const bestMoveUci = validateLegalUci(req.fen, best.bestMoveUci);

    let ponderUci: string | null = null;
    if (bestMoveUci && best.ponderUci) {
      const afterBest = tryApplyMove(req.fen, bestMoveUci);
      if (afterBest) {
        ponderUci = validateLegalUci(afterBest.fenAfter, best.ponderUci);
      }
    }

    const primary = lines[0];
    const score = pickPrimaryScore(primary?.score ?? {});

    const evidence: AnalysisEvidence = {
      requestId: req.requestId,
      gameNodeId: req.gameNodeId,
      fen: req.fen,
      sideToMove: side,
      score,
      bestMoveUci,
      ponderUci,
      lines,
      depth: primary?.depth,
      nodes: primary?.nodes,
      timeMs: primary?.timeMs,
    };

    activeAnalyze = null;
    resetSearchState();
    deps.post({
      type: "result",
      requestId: req.requestId,
      gameNodeId: req.gameNodeId,
      evidence,
    });
  }

  const runtime: StockfishWorkerRuntime = {
    handleRequest(msg) {
      switch (msg.type) {
        case "init":
          void handleInit(msg.requestId, msg.engineUrl);
          break;
        case "analyze":
          handleAnalyze(msg);
          break;
        case "cancel":
          handleCancel(msg.requestId);
          break;
        case "dispose":
          handleDispose(msg.requestId);
          break;
        default:
          break;
      }
    },
    handleEngineLine,
  };

  return runtime;
}
