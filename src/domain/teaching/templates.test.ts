import { describe, expect, it } from "vitest";
import {
  hintQuestionForPosition,
  renderExplanation,
  renderQuip,
  type TemplateContext,
} from "@/domain/teaching/templates";

const ctx: TemplateContext = {
  playedPhrase: "moving your knight to f3",
  suggestedPhrase: "moving your knight to c3",
  playedProblem: null,
  playedBecause: "it develops your knight",
  suggestedBecause: "you control more central squares",
  classification: "inaccuracy",
};

describe("renderExplanation", () => {
  it("always includes a because clause", () => {
    const concepts = [
      "best_move",
      "solid_move",
      "piece_safety",
      "check",
      "capture",
      "threat",
      "development",
      "king_safety",
      "missed_improvement",
    ] as const;
    for (const concept of concepts) {
      const text = renderExplanation(concept, {
        ...ctx,
        playedProblem:
          concept === "piece_safety" || concept === "threat"
            ? "puts it at risk of attack from the black queen"
            : concept === "king_safety"
              ? "makes your king easier to attack"
              : null,
        classification: concept === "solid_move" ? "good" : ctx.classification,
      });
      expect(text).toMatch(/because/i);
      expect(text).not.toMatch(/keeps more of your advantage/i);
      expect(text).not.toMatch(/centipawn/i);
    }
  });

  it("explains checks with a because", () => {
    expect(renderExplanation("check", ctx)).toMatch(/gives check because/i);
  });

  it("explains development with a because", () => {
    expect(renderExplanation("development", ctx)).toMatch(
      /development because/i,
    );
  });

  it("uses a playable-but-better shape for missed improvements", () => {
    expect(renderExplanation("missed_improvement", ctx)).toBe(
      "Moving your knight to f3 is playable, but moving your knight to c3 would be better because you control more central squares.",
    );
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

describe("renderQuip", () => {
  it("keeps mascot lines short", () => {
    expect(renderQuip("best")).toBe("That's the one.");
    expect(renderQuip("mistake")).toBe("That was shaky.");
    expect(renderQuip("blunder")).toBe("Want to look at that?");
  });
});
