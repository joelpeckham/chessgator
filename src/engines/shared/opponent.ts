/**
 * Engine-neutral opponent contract.
 * Maia and Stockfish (fallback) both implement this so the playable slice
 * can swap engines without caring about UCI vs ONNX.
 */

export type OpponentMoveRequest = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  /** Soft time budget for the search / inference. */
  movetimeMs?: number;
  /**
   * Optional prior FENs, oldest first (excluding `fen`).
   * The current Maia browser export repeats the current board across history
   * slots; adapters still accept history so a full-history export can land
   * later without changing the game layer. Stockfish ignores this field.
   */
  historyFens?: string[];
  /** Side-to-move Elo hint (Maia). Ignored by Stockfish. */
  selfElo?: number;
  /** Opponent Elo hint (Maia). Ignored by Stockfish. */
  oppoElo?: number;
  /** Sampling temperature; `0` / omitted means deterministic argmax for Maia. */
  temperature?: number;
  /** Nucleus sampling threshold; `1` disables top-p for Maia. */
  topP?: number;
};

export type OpponentMoveResult = {
  requestId: string;
  gameNodeId: string;
  /** Legal UCI move validated with chess.js before return. */
  moveUci: string;
  source: "stockfish" | "maia";
};

export type OpponentEngineStatus =
  | "idle"
  | "downloading"
  | "initializing"
  | "ready"
  | "failed"
  | "disposed";

export interface OpponentEngine {
  readonly id: string;
  readonly source: "stockfish" | "maia";
  status(): OpponentEngineStatus;
  initialize(): Promise<void>;
  chooseMove(request: OpponentMoveRequest): Promise<OpponentMoveResult>;
  cancel(requestId: string): void;
  dispose(): Promise<void>;
}
