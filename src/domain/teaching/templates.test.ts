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
  problem: null,
  consequence: null,
  playedBecause: "it develops your knight",
  suggestedBecause: "you control more central squares",
  classification: "inaccuracy",
  concept: "missed_improvement",
  evalFrame: null,
  margin: null,
};

describe("renderExplanation", () => {
  it("includes a because clause when one is provided", () => {
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
      const text = renderExplanation({
        ...ctx,
        concept,
        problem:
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

  it("omits because when there is nothing extra to say", () => {
    const text = renderExplanation({
      ...ctx,
      concept: "best_move",
      classification: "best",
      playedBecause: null,
      suggestedPhrase: null,
      suggestedBecause: null,
      margin: "near_equal",
    });
    expect(text).toBe(
      "Moving your knight to f3 is one of several strong moves.",
    );
    expect(text).not.toMatch(/because/i);
  });

  it("uses a grammatical excellent-move verdict", () => {
    const text = renderExplanation({
      ...ctx,
      concept: "development",
      classification: "excellent",
      suggestedPhrase: null,
      suggestedBecause: null,
      playedBecause: "you control more central squares",
    });
    expect(text).toMatch(/is an excellent move because/i);
    expect(text).not.toMatch(/\bis a excellent\b/);
  });

  it("frames still-losing and even positions", () => {
    expect(
      renderExplanation({
        ...ctx,
        concept: "piece_safety",
        classification: "mistake",
        evalFrame: "still_losing",
        problem: "puts it at risk of attack from the black queen",
        suggestedPhrase: null,
        suggestedBecause: null,
        playedBecause: null,
      }),
    ).toMatch(/^You are still worse/i);
    expect(
      renderExplanation({
        ...ctx,
        concept: "development",
        classification: "inaccuracy",
        evalFrame: "holds",
        margin: null,
        suggestedPhrase: null,
        suggestedBecause: null,
        playedBecause: "you control more central squares",
      }),
    ).toMatch(/keeps the position even/i);
  });

  it("never calls a blunder the only move that holds", () => {
    const text = renderExplanation({
      ...ctx,
      classification: "blunder",
      concept: "piece_safety",
      margin: "only",
      problem: "puts it at risk of attack from the black queen",
      suggestedPhrase: "moving your knight to f3",
      suggestedBecause: "you fork the king and queen",
      playedBecause: null,
    });
    expect(text.toLowerCase()).not.toMatch(/only move that holds/);
  });

  it("calls out a clearly strongest move", () => {
    expect(
      renderExplanation({
        ...ctx,
        concept: "best_move",
        classification: "best",
        margin: "clear",
        suggestedPhrase: null,
        suggestedBecause: null,
        playedBecause: null,
      }),
    ).toBe("Moving your knight to f3 is clearly the strongest move.");
  });

  it("does not restate check as the because", () => {
    const text = renderExplanation({
      ...ctx,
      concept: "check",
      problem: null,
      playedBecause: "you take the knight on f7",
    });
    expect(text).toMatch(/because you take the knight/i);
    expect(text).not.toMatch(
      /gives check because it puts the opponent in check/i,
    );
  });

  it("explains development without a tautology", () => {
    const text = renderExplanation({
      ...ctx,
      concept: "development",
      playedBecause: "you control more central squares",
    });
    expect(text).toMatch(/because/i);
    expect(text).not.toMatch(/development because it develops/i);
  });

  it("uses a playable-but-better shape for missed improvements", () => {
    expect(renderExplanation(ctx)).toBe(
      "Moving your knight to f3 is playable, but moving your knight to c3 would be better because you control more central squares.",
    );
  });

  it("does not call a blunder playable", () => {
    expect(
      renderExplanation({
        ...ctx,
        classification: "blunder",
        concept: "missed_improvement",
        playedBecause: null,
      }),
    ).toMatch(/is a blunder, but moving your knight to c3 would be better/i);
    expect(
      renderExplanation({
        ...ctx,
        classification: "blunder",
        concept: "missed_improvement",
        playedBecause: null,
      }),
    ).not.toMatch(/playable/i);
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
