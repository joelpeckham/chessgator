import {
  classifyPlayedMove,
  evalLossForMover,
  type MoveClassification,
} from "@/domain/analysis/classification";
import { toAnalysisSummary } from "@/domain/analysis/score";
import {
  collectTacticalFacts,
  type TacticalFacts,
} from "@/domain/analysis/tactics";
import type {
  AnalysisEvidence,
  AnalysisSummary,
  EvaluationScore,
  PrincipalVariation,
} from "@/domain/analysis/types";
import { tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";

/** Keep only the legal UCI prefix from `fen` (domain-local; mirrors engine helper). */
function legalPvPrefix(fen: string, pvUci: readonly string[]): string[] {
  const legal: string[] = [];
  let current = fen;
  for (const raw of pvUci) {
    const applied = tryApplyMove(current, raw.trim().toLowerCase());
    if (!applied) break;
    legal.push(applied.move.uci);
    current = applied.fenAfter;
  }
  return legal;
}

/** Max plies kept for teaching / show-line. */
export const SHORT_PV_MAX_PLIES = 4;

/**
 * Stable, engine-backed evidence for one completed human move.
 * Built from Stockfish position analyses (before + after) plus chess.js facts.
 */
export type MoveAnalysisEvidence = {
  requestId: string;
  /** Game-tree node id for the position *after* the move. */
  gameNodeId: string;
  playedMove: GameMove;
  fenBefore: string;
  fenAfter: string;
  sideThatMoved: "w" | "b";
  evalBefore: EvaluationScore;
  evalAfter: EvaluationScore;
  /** Centipawn loss for the mover (0 = no loss). */
  evalLossCp: number;
  classification: MoveClassification;
  bestMoveUci: string | null;
  /** MultiPV alternatives from the position before the move. */
  alternatives: PrincipalVariation[];
  /** Short validated improvement PV from the position before the played move. */
  shortPvUci: string[];
  /**
   * Short validated refutation PV from the position after a mistake/blunder.
   * Empty when the played move was not a teachable mistake.
   */
  refutationUci: string[];
  tacticalFacts: TacticalFacts;
  before: AnalysisEvidence;
  after: AnalysisEvidence;
  /**
   * Optional Maia policy probability for the played move.
   * When shown in UI, label as model-predicted likelihood — not population frequency.
   */
  maiaPredictedLikelihood?: number;
};

export type BuildMoveAnalysisInput = {
  requestId: string;
  gameNodeId: string;
  playedMove: GameMove;
  fenBefore: string;
  fenAfter: string;
  before: AnalysisEvidence;
  after: AnalysisEvidence;
  maiaPredictedLikelihood?: number;
  shortPvMaxPlies?: number;
};

export function buildMoveAnalysisEvidence(
  input: BuildMoveAnalysisInput,
): MoveAnalysisEvidence {
  const sideThatMoved = input.playedMove.color;
  const evalBefore = input.before.score;
  const evalAfter = input.after.score;
  const evalLossCp = Math.max(
    0,
    Math.round(
      evalLossForMover({
        evalBeforeWhite: evalBefore,
        evalAfterWhite: evalAfter,
        mover: sideThatMoved,
      }),
    ),
  );

  const bestMoveUci = input.before.bestMoveUci;
  const classification = classifyPlayedMove({
    lossCp: evalLossCp,
    playedUci: input.playedMove.uci,
    bestMoveUci,
  });

  const alternatives = input.before.lines.slice().sort((a, b) => a.multipv - b.multipv);
  const maxPlies = input.shortPvMaxPlies ?? SHORT_PV_MAX_PLIES;

  const bestLine = alternatives[0]?.pvUci ?? [];
  // Improvement line always starts from fenBefore (best / MultiPV #1).
  const shortPvUci = legalPvPrefix(input.fenBefore, bestLine).slice(0, maxPlies);

  // Refutation is separate: from the played position, never prefixed with the
  // mistake itself (Explore / Try instead must not replay the blunder).
  let refutationUci: string[] = [];
  if (
    (classification === "mistake" || classification === "blunder") &&
    input.after.lines[0]?.pvUci?.length
  ) {
    refutationUci = legalPvPrefix(
      input.fenAfter,
      input.after.lines[0].pvUci,
    ).slice(0, maxPlies);
  }

  const tacticalFacts = collectTacticalFacts({
    fenBefore: input.fenBefore,
    move: input.playedMove,
    fenAfter: input.fenAfter,
  });

  return {
    requestId: input.requestId,
    gameNodeId: input.gameNodeId,
    playedMove: input.playedMove,
    fenBefore: input.fenBefore,
    fenAfter: input.fenAfter,
    sideThatMoved,
    evalBefore,
    evalAfter,
    evalLossCp,
    classification,
    bestMoveUci,
    alternatives,
    shortPvUci,
    refutationUci,
    tacticalFacts,
    before: input.before,
    after: input.after,
    ...(input.maiaPredictedLikelihood !== undefined
      ? { maiaPredictedLikelihood: input.maiaPredictedLikelihood }
      : {}),
  };
}

/** Compact tree summary for persistence / node attachment. */
export function evidenceToSummary(
  evidence: MoveAnalysisEvidence,
): AnalysisSummary {
  return toAnalysisSummary({
    scoreWhite: evidence.evalAfter,
    sideToMove: evidence.sideThatMoved === "w" ? "b" : "w",
    bestMoveUci: evidence.bestMoveUci,
    classification: evidence.classification,
  });
}
