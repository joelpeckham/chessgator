import {
  isTeachable,
  type MoveClassification,
  shouldNudge,
} from "@/domain/analysis/classification";
import {
  classifyEvalFrame,
  classifyMoveMargin,
  contrastBenefits,
  dropTautologyReasons,
  fallbackBenefitReasons,
  pickBenefitReasons,
  pickMateBenefits,
  pickProblemReasons,
  rankReasons,
  verifyLikelyTactics,
} from "@/domain/analysis/explanation-reasons";
import type { MoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import {
  collectMoveEffects,
  summarizeLine,
} from "@/domain/analysis/move-effects";
import type { TacticalFacts } from "@/domain/analysis/tactics";
import { tryApplyMove, uciToSan } from "@/domain/game/rules";
import {
  describeBecause,
  describeConsequence,
  describeMove,
  describePlayedProblem,
  describeRefutationPunchline,
} from "@/domain/teaching/move-copy";
import { renderExplanation } from "@/domain/teaching/templates";
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

  const suggestedApplied = suggestedMoveUci
    ? tryApplyMove(evidence.fenBefore, suggestedMoveUci)
    : null;
  const suggestedMoveSan =
    suggestedApplied?.move.san ??
    (suggestedMoveUci ? uciToSan(evidence.fenBefore, suggestedMoveUci) : null);

  const playedEffects = collectMoveEffects({
    fenBefore: evidence.fenBefore,
    move: evidence.playedMove,
    fenAfter: evidence.fenAfter,
    previousMove: evidence.previousMove,
  });
  const suggestedEffects = suggestedApplied
    ? collectMoveEffects({
        fenBefore: evidence.fenBefore,
        move: suggestedApplied.move,
        fenAfter: suggestedApplied.fenAfter,
        previousMove: evidence.previousMove,
      })
    : null;

  const improvement = summarizeLine(
    evidence.fenBefore,
    evidence.shortPvUci,
    4,
    { extendForcing: true },
  );
  const refutation = summarizeLine(
    evidence.fenAfter,
    evidence.refutationUci,
    4,
    { extendForcing: true },
  );

  const problemReasons = rankReasons(
    pickProblemReasons(playedEffects, refutation.events, {
      evalAfter: evidence.evalAfter,
      refutationNetCp: refutation.netMaterialCp,
    }),
  );
  const mateBenefits = pickMateBenefits({
    evalBefore: evidence.evalBefore,
    bestLineScore: evidence.alternatives[0]?.score,
    mover: evidence.playedMove.color,
  });

  const teachable = isTeachable(evidence.classification);
  const explainPlayedAsBenefit = !teachable;

  let playedBenefits = dropTautologyReasons(
    pickBenefitReasons(playedEffects, []),
    evidence.playedMove,
  );
  if (explainPlayedAsBenefit) {
    playedBenefits = [
      ...mateBenefits.filter((reason) => reason.kind === "forces_mate"),
      ...playedBenefits,
    ];
  }

  let suggestedBenefits = suggestedEffects
    ? dropTautologyReasons(
        pickBenefitReasons(suggestedEffects, improvement.events, playedEffects),
        suggestedEffects.move,
      )
    : [];
  if (suggestedEffects && suggestedBenefits.length === 0) {
    suggestedBenefits = dropTautologyReasons(
      pickBenefitReasons(suggestedEffects, improvement.events, playedEffects, {
        keepGenerics: true,
      }),
      suggestedEffects.move,
    );
  }
  if (suggestedEffects && suggestedBenefits.length === 0) {
    suggestedBenefits = fallbackBenefitReasons(suggestedEffects);
  }
  suggestedBenefits = contrastBenefits(
    verifyLikelyTactics(
      [
        ...mateBenefits.filter(
          (reason) =>
            reason.kind === "forces_mate" || reason.kind === "missed_mate",
        ),
        ...suggestedBenefits,
      ],
      evidence.evalLossCp,
    ),
    playedBenefits,
  );
  suggestedBenefits = rankReasons(suggestedBenefits);
  if (suggestedEffects && suggestedBenefits.length === 0) {
    suggestedBenefits = fallbackBenefitReasons(suggestedEffects);
  }

  const copyOpts = {
    fen: evidence.fenBefore,
    seed: evidence.gameNodeId,
  };
  const playedPhrase = describeMove(evidence.playedMove, copyOpts);
  const suggestedPhrase = suggestedApplied
    ? describeMove(suggestedApplied.move, copyOpts)
    : null;
  const problem =
    explainPlayedAsBenefit || !problemReasons[0]
      ? null
      : describePlayedProblem(problemReasons[0], evidence.playedMove, copyOpts);
  const consequence = explainPlayedAsBenefit
    ? null
    : (describeConsequence(
        problemReasons,
        evidence.playedMove.color,
        copyOpts,
      ) ??
      (problemReasons[0]?.kind === "refutation_material"
        ? describeRefutationPunchline(
            refutation.events,
            refutation.netMaterialCp,
            evidence.playedMove.color,
            copyOpts,
          )
        : null));
  const becauseReasons = explainPlayedAsBenefit
    ? playedBenefits
    : problemReasons;
  let playedBecause = describeBecause(
    becauseReasons,
    evidence.playedMove.color,
    copyOpts,
  );
  if (!playedBecause && explainPlayedAsBenefit && playedBenefits.length === 0) {
    playedBecause = describeBecause(
      fallbackBenefitReasons(playedEffects),
      evidence.playedMove.color,
      copyOpts,
    );
  }
  const margin = classifyMoveMargin(
    evidence.alternatives,
    evidence.playedMove.color,
  );
  const skipSuggestionLecture =
    suggestedBenefits.length === 0 &&
    (margin === "near_equal" || evidence.evalLossCp <= 50);
  let suggestedBecause =
    !skipSuggestionLecture && suggestedPhrase && suggestedBenefits.length > 0
      ? describeBecause(suggestedBenefits, evidence.playedMove.color, copyOpts)
      : null;
  if (suggestedBecause && playedBecause && suggestedBecause === playedBecause) {
    suggestedBecause = null;
  }

  const explanation = renderExplanation({
    playedPhrase,
    suggestedPhrase: skipSuggestionLecture ? null : suggestedPhrase,
    problem,
    consequence,
    playedBecause,
    suggestedBecause,
    classification: evidence.classification,
    concept,
    evalFrame: classifyEvalFrame(
      evidence.evalBefore,
      evidence.evalAfter,
      evidence.playedMove.color,
    ),
    margin,
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
    nudge: shouldNudge(evidence.classification),
  };
}

export function chooseConcept(evidence: MoveAnalysisEvidence): TeachingConcept {
  const { classification, tacticalFacts: t, evalLossCp, evalAfter } = evidence;
  const mover = evidence.playedMove.color;
  const mateAgainst =
    evalAfter.mate !== undefined &&
    ((mover === "w" && evalAfter.mate < 0) ||
      (mover === "b" && evalAfter.mate > 0));

  if (classification === "best") return "best_move";

  if (mateAgainst && isTeachable(classification)) {
    return "king_safety";
  }

  for (const concept of CONCEPT_PRIORITY) {
    if (matchesConcept(concept, classification, t, evalLossCp)) {
      return concept;
    }
  }

  return "missed_improvement";
}

function matchesConcept(
  concept: TeachingConcept,
  classification: MoveClassification,
  t: TacticalFacts,
  evalLossCp: number,
): boolean {
  const teachable = isTeachable(classification);

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
  if (evidence.evalAfter.mate !== undefined) score += 0.08;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
