import { describe, expect, it } from "vitest";
import {
  hintQuestionForPosition,
  renderExplanation,
} from "@/domain/teaching/templates";

const ctx = {
  playedSan: "Nf3",
  suggestedSan: "Nc3",
  classification: "inaccuracy" as const,
  evalLossCp: 40,
};

describe("renderExplanation", () => {
  it("explains checks as tempo questions", () => {
    expect(renderExplanation("check", ctx)).toContain("gives check");
  });

  it("explains development on quiet positions", () => {
    expect(renderExplanation("development", ctx)).toContain("development");
  });
});

describe("hintQuestionForPosition", () => {
  it("asks about check before hanging pieces", () => {
    expect(
      hintQuestionForPosition({
        hangingSquares: ["e4"],
        bestMoveSan: "Nf3",
        inCheck: true,
      }),
    ).toContain("in check");
  });
});
