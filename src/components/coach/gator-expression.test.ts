import { describe, expect, it } from "vitest";
import {
  gameOverMood,
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";

describe("gatorExpressionFor", () => {
  it("maps moods to expression assets", () => {
    expect(gatorExpressionFor("idle")).toBe("neutral-happy");
    expect(gatorExpressionFor("analyzing")).toBe("confused");
    expect(gatorExpressionFor("best")).toBe("mischievous");
    expect(gatorExpressionFor("excellent")).toBe("mischievous");
    expect(gatorExpressionFor("good")).toBe("neutral-happy");
    expect(gatorExpressionFor("inaccuracy")).toBe("confused");
    expect(gatorExpressionFor("mistake")).toBe("shocked");
    expect(gatorExpressionFor("blunder")).toBe("scared");
    expect(gatorExpressionFor("gameWon")).toBe("mischievous");
    expect(gatorExpressionFor("gameLost")).toBe("sad");
    expect(gatorExpressionFor("gameDraw")).toBe("neutral-happy");
  });

  it("points at public coach SVGs", () => {
    expect(gatorSrc("scared")).toBe("/coach/gator-scared.svg");
  });

  it("maps game-over results to moods", () => {
    expect(gameOverMood({ result: "whiteWins", humanColor: "w" })).toBe(
      "gameWon",
    );
    expect(gameOverMood({ result: "whiteWins", humanColor: "b" })).toBe(
      "gameLost",
    );
    expect(
      gameOverMood({
        result: "ongoing",
        terminalReason: "resignation",
        humanColor: "w",
      }),
    ).toBe("gameLost");
    expect(gameOverMood({ result: "draw", humanColor: "w" })).toBe("gameDraw");
  });
});
