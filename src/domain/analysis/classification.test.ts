import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_THRESHOLDS,
  classifyEvalLoss,
  classifyPlayedMove,
  evalLossForMover,
  scoreToCpWhite,
  shouldNudge,
} from "@/domain/analysis/classification";

describe("classification thresholds", () => {
  it("maps loss bands explicitly", () => {
    expect(classifyEvalLoss(0)).toBe("best");
    expect(classifyEvalLoss(CLASSIFICATION_THRESHOLDS.excellentMaxLossCp)).toBe(
      "excellent",
    );
    expect(classifyEvalLoss(CLASSIFICATION_THRESHOLDS.goodMaxLossCp)).toBe(
      "good",
    );
    expect(
      classifyEvalLoss(CLASSIFICATION_THRESHOLDS.inaccuracyMaxLossCp),
    ).toBe("inaccuracy");
    expect(classifyEvalLoss(CLASSIFICATION_THRESHOLDS.mistakeMaxLossCp)).toBe(
      "mistake",
    );
    expect(
      classifyEvalLoss(CLASSIFICATION_THRESHOLDS.mistakeMaxLossCp + 1),
    ).toBe("blunder");
  });

  it("never emits a brilliant label", () => {
    const labels = [0, 10, 40, 80, 150, 400].map(classifyEvalLoss);
    expect(labels).not.toContain("brilliant");
  });

  it("marks engine-best as best even with tiny noise loss", () => {
    expect(
      classifyPlayedMove({
        lossCp: 8,
        playedUci: "e2e4",
        bestMoveUci: "e2e4",
      }),
    ).toBe("best");
  });

  it("still treats delivering mate as best when UCI matches", () => {
    expect(
      classifyPlayedMove({
        lossCp: 10_000,
        playedUci: "e1e8",
        bestMoveUci: "e1e8",
      }),
    ).toBe("best");
  });

  it("does not force best when eval loss is past the excellent band", () => {
    expect(
      classifyPlayedMove({
        lossCp: 150,
        playedUci: "e2e4",
        bestMoveUci: "e2e4",
      }),
    ).toBe("mistake");
  });

  it("nudges only mistakes and blunders", () => {
    expect(shouldNudge("best")).toBe(false);
    expect(shouldNudge("good")).toBe(false);
    expect(shouldNudge("inaccuracy")).toBe(false);
    expect(shouldNudge("mistake")).toBe(true);
    expect(shouldNudge("blunder")).toBe(true);
  });
});

describe("eval loss for mover", () => {
  it("charges White when White-eval drops", () => {
    expect(
      evalLossForMover({
        evalBeforeWhite: { cp: 50 },
        evalAfterWhite: { cp: -80 },
        mover: "w",
      }),
    ).toBe(130);
  });

  it("charges Black when White-eval rises", () => {
    expect(
      evalLossForMover({
        evalBeforeWhite: { cp: -20 },
        evalAfterWhite: { cp: 100 },
        mover: "b",
      }),
    ).toBe(120);
  });

  it("maps mate scores to large finite cp", () => {
    expect(scoreToCpWhite({ mate: 2 })).toBeGreaterThan(9_000);
    expect(scoreToCpWhite({ mate: -3 })).toBeLessThan(-9_000);
  });
});
