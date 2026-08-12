import { describe, expect, it } from "vitest";
import {
  gatorExpressionFor,
  gatorSrc,
} from "@/components/coach/gator-expression";

describe("gatorExpressionFor", () => {
  it("maps moods to expression assets", () => {
    expect(gatorExpressionFor("idle")).toBe("neutral-happy");
    expect(gatorExpressionFor("analyzing")).toBe("intrigued");
    expect(gatorExpressionFor("hint")).toBe("intrigued");
    expect(gatorExpressionFor("best")).toBe("really-happy");
    expect(gatorExpressionFor("excellent")).toBe("really-happy");
    expect(gatorExpressionFor("good")).toBe("neutral-happy");
    expect(gatorExpressionFor("inaccuracy")).toBe("intrigued");
    expect(gatorExpressionFor("mistake")).toBe("surprised");
    expect(gatorExpressionFor("blunder")).toBe("afraid");
  });

  it("points at public coach SVGs", () => {
    expect(gatorSrc("afraid")).toBe("/coach/gator-afraid.svg");
  });
});
