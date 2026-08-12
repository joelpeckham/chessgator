import {
  type MoveClassification,
  shouldNudge,
} from "@/domain/analysis/classification";
import type { MoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import type { TacticalFacts } from "@/domain/analysis/tactics";
import { uciToSan } from "@/domain/game/rules";
import { renderExplanation, renderQuip } from "@/domain/teaching/templates";
import type { TeachingConcept, TeachingInsight } from "@/domain/teaching/types";

/**
 * Priority order for concept selection. First matching heuristic wins.
 * Kept explicit so unit tests can pin behavior.
 */
export const CONCEPT_PRIORITY: readonly TeachingConcept[] = [
  "piece_safety",
  "threat",
  "king_safety",
  "check",
  "capture",
  "development",
  "missed_improvement",
  "solid_move",
  "best_move",
] as const;

export function selectTeachingInsight(
  evidence: MoveAnalysisEvidence,
): TeachingInsight {
  const concept = chooseConcept(evidence);
  // Best moves have no "try instead" — don't pick MultiPV #2 as a fake alternate.
  const suggestedMoveUci =
    evidence.classification === "best"
      ? null
      : evidence.bestMoveUci &&
          evidence.bestMoveUci.toLowerCase() !==
            evidence.playedMove.uci.toLowerCase()
        ? evidence.bestMoveUci
        : (evidence.alternatives.find(
            (line) =>
              line.pvUci[0] &&
              line.pvUci[0].toLowerCase() !==
                evidence.playedMove.uci.toLowerCase(),
          )?.pvUci[0] ?? null);

  const suggestedMoveSan = suggestedMoveUci
    ? uciToSan(evidence.fenBefore, suggestedMoveUci)
    : null;

  const explanation = renderExplanation(concept, {
    playedSan: evidence.playedMove.san,
    suggestedSan: suggestedMoveSan,
    classification: evidence.classification,
    evalLossCp: evidence.evalLossCp,
  });

  const confidence = computeConfidence(evidence, concept);

  return {
    concept,
    confidence,
    explanation,
    suggestedMoveUci,
    suggestedMoveSan,
    lineUci: evidence.shortPvUci,
    refutationUci: evidence.refutationUci,
    classification: evidence.classification,
    quip: renderQuip(evidence.classification),
    nudge: shouldNudge(evidence.classification),
  };
}

export function chooseConcept(evidence: MoveAnalysisEvidence): TeachingConcept {
  const { classification, tacticalFacts: t, evalLossCp } = evidence;

  if (classification === "best") return "best_move";

  for (const concept of CONCEPT_PRIORITY) {
    if (matchesConcept(concept, classification, t, evalLossCp)) {
      return concept;
    }
  }

  return classification === "excellent" || classification === "good"
    ? "solid_move"
    : "missed_improvement";
}

function matchesConcept(
  concept: TeachingConcept,
  classification: MoveClassification,
  t: TacticalFacts,
  evalLossCp: number,
): boolean {
  const teachable =
    classification === "inaccuracy" ||
    classification === "mistake" ||
    classification === "blunder";

  switch (concept) {
    case "piece_safety":
      return (
        teachable &&
        (t.movedPieceHanging || t.leftPieceHanging || t.capturedHangingPiece)
      );
    case "threat":
      return teachable && t.ignoredThreat;
    case "king_safety":
      return teachable && (t.kingMoreExposed || t.castlingRightsLost);
    case "check":
      return t.gaveCheck && (teachable || classification === "good");
    case "capture":
      return t.isCapture && teachable;
    case "development":
      return t.developedPiece && evalLossCp <= 50;
    case "missed_improvement":
      return teachable;
    case "solid_move":
      return classification === "excellent" || classification === "good";
    case "best_move":
      return classification === "best";
    default:
      return false;
  }
}

function computeConfidence(
  evidence: MoveAnalysisEvidence,
  concept: TeachingConcept,
): number {
  let score = 0.55;
  if (evidence.evalLossCp >= 200) score += 0.25;
  else if (evidence.evalLossCp >= 100) score += 0.15;
  else if (evidence.evalLossCp >= 50) score += 0.08;

  const t = evidence.tacticalFacts;
  if (
    concept === "piece_safety" &&
    (t.movedPieceHanging || t.leftPieceHanging)
  ) {
    score += 0.12;
  }
  if (concept === "threat" && t.ignoredThreat) score += 0.1;
  if (evidence.before.depth && evidence.before.depth >= 8) score += 0.05;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
