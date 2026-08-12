/**
 * Typed Stockfish worker entry.
 * Loads the versioned lite-single asset from /public/engine (never the package default)
 * and speaks the protocol in `src/engines/stockfish/protocol.ts`.
 */

import { pickPrimaryScore } from "@/domain/analysis/score";
import type {
  AnalysisEvidence,
  PrincipalVariation,
} from "@/domain/analysis/types";
import { tryApplyMove, validateLegalUci } from "@/domain/game/rules";
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

type EngineWorker = Worker;

type WorkerScope = {
  postMessage: (message: StockfishWorkerResponse) => void;
  onmessage: ((event: MessageEvent<StockfishWorkerRequest>) => void) | null;
};

const workerScope = self as unknown as WorkerScope;

let engine: EngineWorker | null = null;
let engineReady = false;
let initInFlight: string | null = null;
let activeAnalyze: StockfishAnalyzeRequest | null = null;
let linesByMultipv = new Map<number, PrincipalVariation>();
let cancelRequested = false;

function post(message: StockfishWorkerResponse): void {
  workerScope.postMessage(message);
}

function sendUci(command: string): void {
  engine?.postMessage(command);
}

function resetSearchState(): void {
  linesByMultipv = new Map();
  cancelRequested = false;
}

function ensureEngine(engineUrl: string): EngineWorker {
  if (engine) return engine;

  const url = engineUrl || stockfishAssetWorkerUrl();
  const nested = new Worker(url);

  nested.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== "string") return;
    for (const line of data.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      handleEngineLine(trimmed);
    }
  };

  nested.onerror = (event) => {
    const requestId = activeAnalyze?.requestId ?? initInFlight ?? "engine";
    post({
      type: "error",
      requestId,
      message: `Stockfish worker error: ${event.message}`,
    });
  };

  engine = nested;
  return nested;
}

function handleEngineLine(line: string): void {
  if (initInFlight) {
    if (line === "uciok") {
      sendUci("isready");
      return;
    }
    if (line === "readyok") {
      engineReady = true;
      const requestId = initInFlight;
      initInFlight = null;
      post({ type: "ready", requestId });
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
      post({ type: "cancelled", requestId });
    }
    return;
  }

  // Ignore readyok / option noise during a search.
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
    const lines = sortedLines(linesByMultipv);
    const score = lines[0]?.score ?? {};
    post({
      type: "progress",
      requestId: activeAnalyze.requestId,
      gameNodeId: activeAnalyze.gameNodeId,
      lines,
      score,
    });
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
  post({
    type: "result",
    requestId: req.requestId,
    gameNodeId: req.gameNodeId,
    evidence,
  });
}

async function handleInit(requestId: string, engineUrl: string): Promise<void> {
  if (engineReady) {
    post({ type: "ready", requestId });
    return;
  }
  if (initInFlight) {
    // Wait for in-flight init by polling ready flag.
    const started = Date.now();
    while (!engineReady && Date.now() - started < 30_000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    if (engineReady) {
      post({ type: "ready", requestId });
      return;
    }
    post({
      type: "error",
      requestId,
      message: "Stockfish init already in progress",
    });
    return;
  }

  try {
    initInFlight = requestId;
    ensureEngine(engineUrl);
    sendUci("uci");
  } catch (err) {
    initInFlight = null;
    post({
      type: "error",
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function handleAnalyze(request: StockfishAnalyzeRequest): void {
  if (!engine || !engineReady) {
    post({
      type: "error",
      requestId: request.requestId,
      message: "Stockfish is not ready",
    });
    return;
  }
  if (activeAnalyze) {
    post({
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
    post({ type: "cancelled", requestId });
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
    engineReady = false;
    initInFlight = null;
    activeAnalyze = null;
    resetSearchState();
    post({ type: "disposed", requestId });
  }
}

workerScope.onmessage = (event: MessageEvent<StockfishWorkerRequest>) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object" || !("type" in msg)) return;

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
};
