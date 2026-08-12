import { DEFAULT_POSITION } from "@/domain/game/rules";
import { describe, expect, it } from "vitest";
import { validateLegalUci, validatePvUci } from "@/engines/stockfish/validate-move";

describe("validateLegalUci", () => {
  it("accepts legal UCI and rejects illegal", () => {
    expect(validateLegalUci(DEFAULT_POSITION, "e2e4")).toBe("e2e4");
    expect(validateLegalUci(DEFAULT_POSITION, "E2E4")).toBe("e2e4");
    expect(validateLegalUci(DEFAULT_POSITION, "e2e5")).toBeNull();
    expect(validateLegalUci(DEFAULT_POSITION, null)).toBeNull();
  });
});

describe("validatePvUci", () => {
  it("keeps only the legal prefix of a PV", () => {
    expect(validatePvUci(DEFAULT_POSITION, ["e2e4", "e7e5", "g1f3", "zzzz"])).toEqual([
      "e2e4",
      "e7e5",
      "g1f3",
    ]);
  });

  it("returns empty when the first move is illegal", () => {
    expect(validatePvUci(DEFAULT_POSITION, ["a1a1", "e2e4"])).toEqual([]);
  });
});
