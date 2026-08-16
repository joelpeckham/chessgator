import { describe, expect, it } from "vitest";
import { shouldShowCoachAnnotations } from "@/features/game/shell-view";

describe("shouldShowCoachAnnotations", () => {
  it("shows hint marks even when there is no last-move insight", () => {
    expect(
      shouldShowCoachAnnotations({
        coachUnavailable: false,
        expanded: true,
        hasInsight: false,
        hasHint: true,
      }),
    ).toBe(true);
  });

  it("keeps hint marks if the balloon is collapsed", () => {
    expect(
      shouldShowCoachAnnotations({
        coachUnavailable: false,
        expanded: false,
        hasInsight: false,
        hasHint: true,
      }),
    ).toBe(true);
  });

  it("shows last-move arrows only while the balloon is open", () => {
    expect(
      shouldShowCoachAnnotations({
        coachUnavailable: false,
        expanded: true,
        hasInsight: true,
        hasHint: false,
      }),
    ).toBe(true);
    expect(
      shouldShowCoachAnnotations({
        coachUnavailable: false,
        expanded: false,
        hasInsight: true,
        hasHint: false,
      }),
    ).toBe(false);
  });

  it("hides marks when the coach is unavailable", () => {
    expect(
      shouldShowCoachAnnotations({
        coachUnavailable: true,
        expanded: true,
        hasInsight: true,
        hasHint: true,
      }),
    ).toBe(false);
  });
});
