import type { AnalysisSummary, EvaluationScore } from "@/domain/analysis/types";

export type SideToMove = "w" | "b";

/**
 * Convert a UCI score (side-to-move perspective) into White's perspective.
 *
 * UCI `info score cp N` / `mate N` are always from the side to move.
 * White's perspective: positive = White better / White mates.
 */
export function scoreFromSideToMove(
  score: EvaluationScore,
  sideToMove: SideToMove,
): EvaluationScore {
  if (sideToMove === "w") {
    return { ...score };
  }
  return negateScore(score);
}

/** Convert White's-perspective score into side-to-move perspective. */
export function scoreToSideToMove(
  score: EvaluationScore,
  sideToMove: SideToMove,
): EvaluationScore {
  if (sideToMove === "w") {
    return { ...score };
  }
  return negateScore(score);
}

export function negateScore(score: EvaluationScore): EvaluationScore {
  const next: EvaluationScore = {};
  if (score.cp !== undefined) next.cp = -score.cp;
  if (score.mate !== undefined) next.mate = -score.mate;
  return next;
}

/** Compact tree summary uses side-to-move perspective. */
export function toAnalysisSummary(input: {
  scoreWhite: EvaluationScore;
  sideToMove: SideToMove;
  bestMoveUci?: string | null;
  classification?: string;
}): AnalysisSummary {
  const stm = scoreToSideToMove(input.scoreWhite, input.sideToMove);
  const summary: AnalysisSummary = {};
  if (stm.cp !== undefined) summary.evalCp = stm.cp;
  if (stm.mate !== undefined) summary.mate = stm.mate;
  if (input.bestMoveUci) summary.bestMoveUci = input.bestMoveUci;
  if (input.classification) summary.classification = input.classification;
  return summary;
}

/** Prefer mate over cp when both appear (should not happen from clean UCI). */
export function pickPrimaryScore(score: EvaluationScore): EvaluationScore {
  if (score.mate !== undefined) return { mate: score.mate };
  if (score.cp !== undefined) return { cp: score.cp };
  return {};
}
