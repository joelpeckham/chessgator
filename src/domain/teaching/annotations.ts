import type { MoveAnalysisEvidence } from "@/domain/analysis";
import type { HintStep, TeachingInsight } from "@/domain/teaching/types";

export type SemanticArrowKind = "hint" | "hint-line" | "better";

/** Engine/hint marks in semantic terms — CSS tokens are applied in the board layer. */
export type SemanticBoardAnnotation = {
  highlightSquares: string[];
  arrows: Array<{ from: string; to: string; kind: SemanticArrowKind }>;
  labels: Array<{ square: string; text: string }>;
};

export const EMPTY_BOARD_ANNOTATIONS: SemanticBoardAnnotation = {
  highlightSquares: [],
  arrows: [],
  labels: [],
};

/** Derive board marks from the current insight and hint ladder. */
export function annotationsFromInsight(
  insight: TeachingInsight | null,
  _evidence: MoveAnalysisEvidence | null,
  hint: HintStep | null,
): SemanticBoardAnnotation {
  const highlightSquares = new Set<string>();
  const arrows: SemanticBoardAnnotation["arrows"] = [];

  const hintShowsMove = Boolean(
    hint?.candidateMoveUci ||
      (hint && hint.level >= 3 && hint.lineUci.length > 0),
  );

  if (hint) {
    for (const sq of hint.highlightSquares) highlightSquares.add(sq);
    if (hint.candidateMoveUci && hint.candidateMoveUci.length >= 4) {
      arrows.push({
        from: hint.candidateMoveUci.slice(0, 2),
        to: hint.candidateMoveUci.slice(2, 4),
        kind: "hint",
      });
    }
    if (hint.level >= 3) {
      for (const uci of hint.lineUci) {
        if (uci.length < 4) continue;
        arrows.push({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          kind: "hint-line",
        });
      }
    }
  }

  if (!hintShowsMove && insight?.suggestedMoveUci) {
    const uci = insight.suggestedMoveUci;
    if (uci.length >= 4) {
      arrows.push({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        kind: "better",
      });
    }
  }

  return {
    highlightSquares: [...highlightSquares],
    arrows,
    labels: [],
  };
}
