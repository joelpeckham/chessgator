/**
 * Engine-neutral analysis types.
 *
 * Score perspective convention:
 * - Live analysis (`EvaluationScore`, `AnalysisEvidence`) uses **White's perspective**:
 *   positive centipawns / mate means White is better / White mates.
 * - Compact tree storage (`AnalysisSummary`) keeps **side-to-move perspective**
 *   for a small, position-local snapshot (positive = side to move is better).
 * Convert with helpers in `./score`.
 */

/**
 * Engine-neutral analysis summary attached to a game-tree node.
 * Workers and coaching layers enrich this later; the game domain only stores it.
 */
export type AnalysisSummary = {
  /** Centipawn evaluation from the side to move's perspective, if available. */
  evalCp?: number;
  /** Mate in N (positive = side to move mates), if available. */
  mate?: number;
  /** Best move in UCI, if available. */
  bestMoveUci?: string;
  /** Compact classification label (e.g. blunder, inaccuracy). */
  classification?: string;
};

/** Centipawn or mate score from White's perspective. */
export type EvaluationScore = {
  /** Centipawns; positive = White better. Mutually exclusive with `mate` when set from UCI. */
  cp?: number;
  /** Mate in N plies for the mating side; positive = White mates, negative = Black mates. */
  mate?: number;
};

/** One MultiPV line after legal-move validation along the PV. */
export type PrincipalVariation = {
  multipv: number;
  score: EvaluationScore;
  /** UCI moves; only prefixes that remain legal from the analyzed FEN are kept. */
  pvUci: string[];
  depth?: number;
  seldepth?: number;
  nodes?: number;
  timeMs?: number;
};

/**
 * Full analysis payload for coaching / UI. Not persisted as-is on the tree.
 * Scores are White's perspective (see file header).
 */
export type AnalysisEvidence = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  /** Side to move in `fen` (`w` | `b`). */
  sideToMove: "w" | "b";
  score: EvaluationScore;
  bestMoveUci: string | null;
  ponderUci?: string | null;
  lines: PrincipalVariation[];
  depth?: number;
  nodes?: number;
  timeMs?: number;
};

/** Priority bands for the single Stockfish work queue (lower = sooner). */
export type AnalysisPriority = "opponent" | "user" | "background";

export const ANALYSIS_PRIORITY_RANK: Record<AnalysisPriority, number> = {
  opponent: 0,
  user: 1,
  background: 2,
};
