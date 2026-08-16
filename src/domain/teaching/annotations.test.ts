import { describe, expect, it } from "vitest";
import { annotationsFromInsight } from "@/domain/teaching/annotations";
import type { HintStep, TeachingInsight } from "@/domain/teaching/types";

const insight: TeachingInsight = {
  concept: "missed_improvement",
  confidence: 0.8,
  explanation: "d4 is a mistake.",
  suggestedMoveUci: "e2e4",
  suggestedMoveSan: "e4",
  lineUci: ["e2e4"],
  refutationUci: [],
  classification: "mistake",
  nudge: false,
};

function hint(partial: Partial<HintStep>): HintStep {
  return {
    level: 1,
    question: "",
    highlightSquares: ["e4"],
    candidateMoveUci: null,
    candidateMoveSan: null,
    lineUci: [],
    ...partial,
  };
}

describe("annotationsFromInsight", () => {
  it("shows the suggested move when no hint move is up", () => {
    const marks = annotationsFromInsight(insight, null, null);
    expect(marks.arrows).toEqual([{ from: "e2", to: "e4", kind: "better" }]);
    expect(marks.labels).toEqual([{ square: "e4", text: "better" }]);
  });

  it("hides the suggested move while a hint candidate is showing", () => {
    const marks = annotationsFromInsight(
      insight,
      null,
      hint({
        level: 2,
        candidateMoveUci: "g1f3",
        candidateMoveSan: "Nf3",
      }),
    );
    expect(marks.arrows).toEqual([{ from: "g1", to: "f3", kind: "hint" }]);
    expect(marks.arrows.some((arrow) => arrow.kind === "better")).toBe(false);
    expect(marks.labels).toEqual([{ square: "f3", text: "hint" }]);
  });

  it("draws a hint line even when there is no last-move insight", () => {
    const marks = annotationsFromInsight(
      null,
      null,
      hint({
        level: 3,
        candidateMoveUci: "g1f3",
        candidateMoveSan: "Nf3",
        lineUci: ["g1f3", "b8c6"],
      }),
    );
    expect(marks.arrows).toEqual([
      { from: "g1", to: "f3", kind: "hint" },
      { from: "g1", to: "f3", kind: "hint-line" },
      { from: "b8", to: "c6", kind: "hint-line" },
    ]);
  });

  it("hides the suggested move while a hint line is showing", () => {
    const marks = annotationsFromInsight(
      insight,
      null,
      hint({
        level: 3,
        candidateMoveUci: "g1f3",
        candidateMoveSan: "Nf3",
        lineUci: ["g1f3", "b8c6"],
      }),
    );
    expect(marks.arrows.map((arrow) => arrow.kind)).toEqual([
      "hint",
      "hint-line",
      "hint-line",
    ]);
    expect(marks.arrows.some((arrow) => arrow.kind === "better")).toBe(false);
  });
});
