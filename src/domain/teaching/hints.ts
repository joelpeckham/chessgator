import {
  pickBenefitReasons,
  rankReasons,
  reasonSquares,
} from "@/domain/analysis/explanation-reasons";
import { collectMoveEffects } from "@/domain/analysis/move-effects";
import { hangingSquaresFor } from "@/domain/analysis/tactics";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { createChess, tryApplyMove, uciToSan } from "@/domain/game/rules";
import type { Square } from "@/domain/game/types";
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

  const motif = hintMotif(input, hanging);
  const question = hintQuestionForPosition({
    hangingSquares: hanging,
    bestMoveSan: bestSan,
    inCheck: chess.isCheck(),
    question: motif.question,
  });

  const highlightSquares =
    motif.squares.length > 0
      ? motif.squares
      : squaresForHint({ hanging, bestUci });

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

function hintMotif(
  input: BuildHintInput,
  hanging: string[],
): {
  question: string | undefined;
  squares: string[];
} {
  const chess = createChess(input.fen);
  if (chess.isCheck()) {
    return { question: undefined, squares: [] };
  }

  const hangingHint = hangingQuestion(chess, hanging, input.sideToMove);
  if (hangingHint) return hangingHint;

  const dummy = input.positionAnalysis?.bestMoveUci
    ? tryApplyMove(input.fen, input.positionAnalysis.bestMoveUci)
    : null;
  if (!dummy) return { question: undefined, squares: [] };

  const effects = collectMoveEffects({
    fenBefore: input.fen,
    move: dummy.move,
    fenAfter: dummy.fenAfter,
  });
  const top = rankReasons(pickBenefitReasons(effects, []))[0];
  if (
    !top ||
    top.kind === "stronger_position" ||
    top.kind === "center_control"
  ) {
    return { question: undefined, squares: [] };
  }
  const squares = reasonSquares(top);
  if (top.kind === "fork") {
    return {
      question: "A fork is available here — can you hit two targets at once?",
      squares,
    };
  }
  if (top.kind === "pin") {
    return {
      question:
        "A pin is available here — can you freeze a piece against a more valuable one?",
      squares,
    };
  }
  if (top.kind === "skewer") {
    return {
      question:
        "A skewer is available here — can you attack through a valuable piece?",
      squares,
    };
  }
  if (top.kind === "saves_piece") {
    return {
      question: `Your ${pieceName(top.piece.type)} is under fire — can you save it with tempo?`,
      squares: [...squares, top.piece.square],
    };
  }
  return { question: undefined, squares };
}

function hangingQuestion(
  chess: ReturnType<typeof createChess>,
  hanging: string[],
  sideToMove: "w" | "b",
): { question: string; squares: string[] } | null {
  const square = hanging[0] as Square | undefined;
  if (!square) return null;
  const piece = chess.get(square);
  if (!piece || piece.color !== sideToMove) return null;
  return {
    question: `Your ${pieceName(piece.type)} is attacked — can you save it with tempo?`,
    squares: hanging.slice(0, 2),
  };
}

function pieceName(type: string): string {
  switch (type) {
    case "p":
      return "pawn";
    case "n":
      return "knight";
    case "b":
      return "bishop";
    case "r":
      return "rook";
    case "q":
      return "queen";
    case "k":
      return "king";
    default:
      return "piece";
  }
}

function squaresForHint(input: {
  hanging: string[];
  bestUci: string | null;
}): string[] {
  const squares = new Set<string>();
  for (const sq of input.hanging.slice(0, 2)) squares.add(sq);
  if (input.bestUci && input.bestUci.length >= 4) {
    squares.add(input.bestUci.slice(0, 2));
    squares.add(input.bestUci.slice(2, 4));
  }
  return [...squares];
}
