import type { BoardArrow } from "@/components/board/arrow-utils";
import type {
  SemanticArrowKind,
  SemanticBoardAnnotation,
} from "@/domain/teaching";

export type { SemanticArrowKind, SemanticBoardAnnotation };

const ARROW_COLOR: Record<SemanticArrowKind, string> = {
  hint: "var(--board-arrow)",
  "hint-line": "color-mix(in oklch, var(--board-arrow) 70%, var(--background))",
  better: "var(--board-arrow)",
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
