export {
  MAIA3_5M_FP16_ONNX,
  MAIA_ORT_VERSION,
  MAIA_ORT_WASM_PATHS,
} from "@/engines/maia/assets";

export {
  MaiaClient,
  type MaiaClientOptions,
  type MaiaClientStatus,
  type MaiaInferOptions,
  type MaiaInferResult,
} from "@/engines/maia/client";

export {
  encodeTokensForBrowserExport,
  eloTensors,
  fromVocabUci,
  indexToSquare,
  mirrorMove,
  mirrorSquare,
  squareToIndex,
  tokenizeFen,
  toVocabUci,
} from "@/engines/maia/encode";

export {
  applyLegalMask,
  countLegal,
  legalMovesMask,
} from "@/engines/maia/mask";

export {
  argmax,
  sampleFromLogits,
  stableSoftmax,
  topKFromLogits,
  type SampleOptions,
} from "@/engines/maia/sample";

export {
  BASE_MOVE_COUNT,
  MOVE_VOCAB_SIZE,
  PROMOTION_COUNT,
  PROMOTION_PIECES,
  getAllPossibleMoves,
  getMoveIndexMap,
  indexToMove,
  moveToIndex,
  promotionMoveIndex,
  quietMoveIndex,
} from "@/engines/maia/vocabulary";

export {
  createBrowserWorkerTransport,
  createDefaultMaiaTransport,
  createMaiaWorker,
  type MaiaTransport,
  type WorkerLike,
} from "@/engines/maia/transport";

export {
  isMaiaWorkerResponse,
  type MaiaWorkerRequest,
  type MaiaWorkerResponse,
} from "@/engines/maia/protocol";
