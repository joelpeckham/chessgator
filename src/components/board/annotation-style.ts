import type { BoardArrow } from "@/components/board/arrow-utils";

export type SemanticArrowKind = "hint" | "hint-line" | "better";

export type SemanticBoardAnnotation = {
  highlightSquares: string[];
  arrows: Array<{ from: string; to: string; kind: SemanticArrowKind }>;
  labels: Array<{ square: string; text: string }>;
};

const ARROW_COLOR: Record<SemanticArrowKind, string> = {
  hint: "var(--primary)",
  "hint-line": "color-mix(in oklch, var(--primary) 70%, transparent)",
  better: "var(--primary)",
};

/** Map coaching marks onto board presentation tokens. */
export function styleBoardAnnotations(annotations: SemanticBoardAnnotation): {
  highlightSquares: string[];
  labels: SemanticBoardAnnotation["labels"];
  arrows: BoardArrow[];
} {
  return {
    highlightSquares: annotations.highlightSquares,
    labels: annotations.labels,
    arrows: annotations.arrows.map((arrow) => ({
      from: arrow.from,
      to: arrow.to,
      color: ARROW_COLOR[arrow.kind],
    })),
  };
}
