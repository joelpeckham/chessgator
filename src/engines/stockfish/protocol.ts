import type {
  AnalysisEvidence,
  EvaluationScore,
  PrincipalVariation,
} from "@/domain/analysis/types";

/** Typed messages between the main-thread client and `stockfish-worker`. */

export type StockfishInitRequest = {
  type: "init";
  requestId: string;
  /** Public path to the Stockfish.js loader (lite-single). */
  engineUrl: string;
};

export type StockfishAnalyzeRequest = {
  type: "analyze";
  requestId: string;
  gameNodeId: string;
  fen: string;
  multipv: number;
  movetimeMs: number;
};

export type StockfishCancelRequest = {
  type: "cancel";
  requestId: string;
};

export type StockfishDisposeRequest = {
  type: "dispose";
  requestId: string;
};

export type StockfishWorkerRequest =
  | StockfishInitRequest
  | StockfishAnalyzeRequest
  | StockfishCancelRequest
  | StockfishDisposeRequest;

export type StockfishReadyResponse = {
  type: "ready";
  requestId: string;
};

export type StockfishProgressResponse = {
  type: "progress";
  requestId: string;
  gameNodeId: string;
  lines: PrincipalVariation[];
  score: EvaluationScore;
};

export type StockfishResultResponse = {
  type: "result";
  requestId: string;
  gameNodeId: string;
  evidence: AnalysisEvidence;
};

export type StockfishCancelledResponse = {
  type: "cancelled";
  requestId: string;
};

export type StockfishErrorResponse = {
  type: "error";
  requestId: string;
  message: string;
};

export type StockfishDisposedResponse = {
  type: "disposed";
  requestId: string;
};

export type StockfishWorkerResponse =
  | StockfishReadyResponse
  | StockfishProgressResponse
  | StockfishResultResponse
  | StockfishCancelledResponse
  | StockfishErrorResponse
  | StockfishDisposedResponse;

export function isStockfishWorkerResponse(
  value: unknown,
): value is StockfishWorkerResponse {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "ready" ||
    type === "progress" ||
    type === "result" ||
    type === "cancelled" ||
    type === "error" ||
    type === "disposed"
  );
}
