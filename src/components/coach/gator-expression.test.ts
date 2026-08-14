import { describe, expect, it } from "vitest";
import {
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";

describe("gatorExpressionFor", () => {
  it("maps moods to expression assets", () => {
    expect(gatorExpressionFor("idle")).toBe("neutral-happy");
    expect(gatorExpressionFor("analyzing")).toBe("confused");
    expect(gatorExpressionFor("hint")).toBe("confused");
    expect(gatorExpressionFor("best")).toBe("mischievous");
    expect(gatorExpressionFor("excellent")).toBe("mischievous");
    expect(gatorExpressionFor("good")).toBe("neutral-happy");
    expect(gatorExpressionFor("inaccuracy")).toBe("confused");
    expect(gatorExpressionFor("mistake")).toBe("shocked");
    expect(gatorExpressionFor("blunder")).toBe("scared");
  });

  it("points at public coach SVGs", () => {
    expect(gatorSrc("scared")).toBe("/coach/gator-scared.svg");
  });
});
