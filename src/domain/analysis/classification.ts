import { pickPrimaryScore } from "@/domain/analysis/score";
import type { EvaluationScore } from "@/domain/analysis/types";

/**
 * Move quality labels derived from centipawn loss for the side that moved.
 * Deliberately excludes `brilliant` for v1.
 */
export type MoveClassification =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

/**
 * Explicit loss thresholds (centipawns from the mover's perspective).
 * Tuned for teachable feedback, not Lichess/Chess.com parity.
 */
export const CLASSIFICATION_THRESHOLDS = {
  /** Played engine best (or zero loss). */
  bestMaxLossCp: 0,
  excellentMaxLossCp: 20,
  goodMaxLossCp: 50,
  inaccuracyMaxLossCp: 100,
  mistakeMaxLossCp: 200,
  // blunder: anything above mistakeMaxLossCp
} as const;

/** Classifications that nudge the mascot (teaser, not auto-open). */
export const NUDGE_CLASSIFICATIONS: ReadonlySet<MoveClassification> = new Set([
  "mistake",
  "blunder",
]);

/**
 * Approximate a White-perspective score as centipawns for loss math.
 * Mate scores map to a large finite value (±10_000 − ply bias).
 */
export function scoreToCpWhite(score: EvaluationScore): number | null {
  const primary = pickPrimaryScore(score);
  if (primary.mate !== undefined) {
    const sign = primary.mate > 0 ? 1 : -1;
    const plies = Math.min(50, Math.abs(primary.mate));
    return sign * (10_000 - plies * 10);
  }
  if (primary.cp !== undefined) return primary.cp;
  return null;
}

/**
 * Centipawn loss for the side that just moved (White's eval swing against them).
 * Positive = the mover made their position worse.
 */
export function evalLossForMover(input: {
  evalBeforeWhite: EvaluationScore;
  evalAfterWhite: EvaluationScore;
  mover: "w" | "b";
}): number {
  const before = scoreToCpWhite(input.evalBeforeWhite);
  const after = scoreToCpWhite(input.evalAfterWhite);
  if (before === null || after === null) return 0;

  // White wants higher White-eval; Black wants lower White-eval.
  const deltaForWhite = after - before;
  return input.mover === "w" ? -deltaForWhite : deltaForWhite;
}

export function classifyEvalLoss(lossCp: number): MoveClassification {
  const loss = Math.max(0, Math.round(lossCp));
  const t = CLASSIFICATION_THRESHOLDS;
  if (loss <= t.bestMaxLossCp) return "best";
  if (loss <= t.excellentMaxLossCp) return "excellent";
  if (loss <= t.goodMaxLossCp) return "good";
  if (loss <= t.inaccuracyMaxLossCp) return "inaccuracy";
  if (loss <= t.mistakeMaxLossCp) return "mistake";
  return "blunder";
}

/**
 * Prefer `best` when the played UCI matches the engine's top move, as long as
 * the reported loss stays within the excellent band. Larger losses classify
 * by eval even if the UCI strings match.
 */
export function classifyPlayedMove(input: {
  lossCp: number;
  playedUci: string;
  bestMoveUci: string | null;
}): MoveClassification {
  if (
    input.bestMoveUci &&
    input.playedUci.toLowerCase() === input.bestMoveUci.toLowerCase()
  ) {
    if (input.lossCp <= CLASSIFICATION_THRESHOLDS.excellentMaxLossCp) {
      return "best";
    }
    // Mate-score artifacts (delivering mate) can look like a huge loss.
    if (input.lossCp >= 5000) return "best";
  }
  return classifyEvalLoss(input.lossCp);
}

export function shouldNudge(classification: MoveClassification): boolean {
  return NUDGE_CLASSIFICATIONS.has(classification);
}

export function isTeachable(classification: MoveClassification): boolean {
  return (
    classification === "inaccuracy" ||
    classification === "mistake" ||
    classification === "blunder"
  );
}
