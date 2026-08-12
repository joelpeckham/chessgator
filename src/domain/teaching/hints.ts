import { hangingSquaresFor } from "@/domain/analysis/tactics";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { createChess, uciToSan } from "@/domain/game/rules";
import { hintQuestionForPosition } from "@/domain/teaching/templates";
import type { HintLevel, HintStep } from "@/domain/teaching/types";

export const MAX_HINT_LEVEL: HintLevel = 3;

export type BuildHintInput = {
  fen: string;
  /** Side to move that will receive the hint (usually White). */
  sideToMove: "w" | "b";
  /** Engine analysis of the current position (MultiPV). */
  positionAnalysis: AnalysisEvidence | null;
  level: HintLevel;
  shortLineMaxPlies?: number;
};

/**
 * Progressive hint ladder:
 * 0 question → 1 visual squares → 2 candidate move → 3 short line.
 */
export function buildHintStep(input: BuildHintInput): HintStep {
  const level = clampLevel(input.level);
  const chess = createChess(input.fen);
  const hanging = hangingSquaresFor(chess, input.sideToMove);
  const bestUci = input.positionAnalysis?.bestMoveUci ?? null;
  const bestSan = bestUci ? uciToSan(input.fen, bestUci) : null;
  const lineUci = (
    input.positionAnalysis?.lines[0]?.pvUci ?? (bestUci ? [bestUci] : [])
  ).slice(0, input.shortLineMaxPlies ?? 3);

  const question = hintQuestionForPosition({
    hangingSquares: hanging,
    bestMoveSan: bestSan,
    inCheck: chess.isCheck(),
  });

  const highlightSquares = squaresForHint({
    hanging,
    bestUci,
    fen: input.fen,
  });

  return {
    level,
    question,
    highlightSquares: level >= 1 ? highlightSquares : [],
    candidateMoveUci: level >= 2 ? bestUci : null,
    candidateMoveSan: level >= 2 ? bestSan : null,
    lineUci: level >= 3 ? lineUci : [],
  };
}

export function nextHintLevel(current: HintLevel): HintLevel {
  if (current >= MAX_HINT_LEVEL) return MAX_HINT_LEVEL;
  return (current + 1) as HintLevel;
}

function clampLevel(level: number): HintLevel {
  if (level <= 0) return 0;
  if (level >= 3) return 3;
  return level as HintLevel;
}

function squaresForHint(input: {
  hanging: string[];
  bestUci: string | null;
  fen: string;
}): string[] {
  const squares = new Set<string>();
  for (const sq of input.hanging.slice(0, 2)) squares.add(sq);
  if (input.bestUci && input.bestUci.length >= 4) {
    squares.add(input.bestUci.slice(0, 2));
    squares.add(input.bestUci.slice(2, 4));
  }
  return [...squares];
}
