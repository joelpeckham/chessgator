/**
 * Engine-neutral analysis types.
 *
 * Score perspective convention:
 * Live analysis (`EvaluationScore`, `AnalysisEvidence`) uses **White's perspective**:
 * positive centipawns / mate means White is better / White mates.
 * Convert with helpers in `./score` when a side-to-move view is needed.
 */

/** Centipawn or mate score from White's perspective. */
export type EvaluationScore = {
  /** Centipawns; positive = White better. Mutually exclusive with `mate` when set from UCI. */
  cp?: number;
  /** Mate in N full moves (UCI); positive = White mates, negative = Black mates. 0 = White just delivered mate. */
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
export type AnalysisPriority = "user" | "background";

export const ANALYSIS_PRIORITY_RANK: Record<AnalysisPriority, number> = {
  user: 0,
  background: 1,
};
