/** Typed messages between the main-thread Maia client and `maia-worker`. */

export type MaiaInitRequest = {
  type: "init";
  requestId: string;
  /** Public URL of the pinned ONNX model. */
  modelUrl: string;
  /** Prefix or map for onnxruntime-web WASM binaries. */
  wasmPaths: string;
};

export type MaiaInferRequest = {
  type: "infer";
  requestId: string;
  gameNodeId: string;
  fen: string;
  selfElo: number;
  oppoElo: number;
  temperature: number;
  topP: number;
};

export type MaiaCancelRequest = {
  type: "cancel";
  requestId: string;
};

export type MaiaDisposeRequest = {
  type: "dispose";
  requestId: string;
};

export type MaiaWorkerRequest =
  | MaiaInitRequest
  | MaiaInferRequest
  | MaiaCancelRequest
  | MaiaDisposeRequest;

export type MaiaStatusPhase =
  | "downloading"
  | "initializing"
  | "ready"
  | "failed"
  | "disposed";

export type MaiaStatusResponse = {
  type: "status";
  requestId: string;
  phase: MaiaStatusPhase;
  detail?: string;
};

export type MaiaReadyResponse = {
  type: "ready";
  requestId: string;
  executionProvider: "webgpu" | "wasm";
};

export type MaiaCandidateMove = {
  moveUci: string;
  probability: number;
};

export type MaiaResultResponse = {
  type: "result";
  requestId: string;
  gameNodeId: string;
  moveUci: string;
  candidates: MaiaCandidateMove[];
  /** Softmax value head [loss, draw, win] for side to move, if present. */
  value?: { loss: number; draw: number; win: number };
};

export type MaiaCancelledResponse = {
  type: "cancelled";
  requestId: string;
};

export type MaiaErrorResponse = {
  type: "error";
  requestId: string;
  message: string;
};

export type MaiaDisposedResponse = {
  type: "disposed";
  requestId: string;
};

export type MaiaWorkerResponse =
  | MaiaStatusResponse
  | MaiaReadyResponse
  | MaiaResultResponse
  | MaiaCancelledResponse
  | MaiaErrorResponse
  | MaiaDisposedResponse;

export function isMaiaWorkerResponse(
  value: unknown,
): value is MaiaWorkerResponse {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "status" ||
    type === "ready" ||
    type === "result" ||
    type === "cancelled" ||
    type === "error" ||
    type === "disposed"
  );
}
