import { describe, expect, it } from "vitest";
import {
  negateScore,
  pickPrimaryScore,
  scoreFromSideToMove,
  scoreToSideToMove,
} from "@/domain/analysis/score";

describe("score normalization", () => {
  it("keeps side-to-move scores for White", () => {
    expect(scoreFromSideToMove({ cp: 35 }, "w")).toEqual({ cp: 35 });
    expect(scoreFromSideToMove({ mate: 3 }, "w")).toEqual({ mate: 3 });
  });

  it("flips side-to-move scores for Black into White's perspective", () => {
    expect(scoreFromSideToMove({ cp: 40 }, "b")).toEqual({ cp: -40 });
    expect(scoreFromSideToMove({ mate: 2 }, "b")).toEqual({ mate: -2 });
    expect(scoreFromSideToMove({ mate: -4 }, "b")).toEqual({ mate: 4 });
  });

  it("resolves mate-in-0 for the side that is checkmated", () => {
    expect(scoreFromSideToMove({ mate: 0 }, "w")).toEqual({ mate: -1 });
    expect(scoreFromSideToMove({ mate: 0 }, "b")).toEqual({ mate: 1 });
  });

  it("round-trips White perspective back to side-to-move", () => {
    const white = { cp: -90 };
    expect(scoreToSideToMove(white, "b")).toEqual({ cp: 90 });
    expect(scoreToSideToMove(white, "w")).toEqual({ cp: -90 });
  });

  it("negates and prefers mate", () => {
    expect(negateScore({ cp: 12, mate: 1 })).toEqual({ cp: -12, mate: -1 });
    expect(pickPrimaryScore({ cp: 12, mate: 1 })).toEqual({ mate: 1 });
  });
});
