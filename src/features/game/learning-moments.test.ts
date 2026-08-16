import { describe, expect, it } from "vitest";
import type { TeachingInsight } from "@/domain/teaching";
import {
  fromSavedLesson,
  toSavedLesson,
} from "@/features/game/learning-moments";

function insight(overrides: Partial<TeachingInsight> = {}): TeachingInsight {
  return {
    concept: "missed_improvement",
    confidence: 0.8,
    explanation:
      "Moving your pawn to d4 is a mistake because the e5 pawn hangs.",
    suggestedMoveUci: "e2e4",
    suggestedMoveSan: "e4",
    lineUci: ["e2e4", "e7e5"],
    refutationUci: ["d7d5"],
    classification: "mistake",
    nudge: true,
    ...overrides,
  };
}

describe("saved lesson round-trip", () => {
  it("preserves insight fields through the storage DTO", () => {
    const original = insight();
    const restored = fromSavedLesson(toSavedLesson(original));
    expect(restored).toEqual(original);
  });

  it("drops unknown concepts", () => {
    const saved = toSavedLesson(insight());
    expect(fromSavedLesson({ ...saved, concept: "not_a_concept" })).toBeNull();
  });
});
