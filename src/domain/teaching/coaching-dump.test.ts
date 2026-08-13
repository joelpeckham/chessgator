import { describe, expect, it } from "vitest";
import { LICHESS_MOTIF_FIXTURES } from "@/domain/analysis/motif-precision";
import {
  dumpScenario,
  puzzleToScenarios,
} from "@/domain/teaching/coaching-dump";

describe("coaching dump", () => {
  it("renders a motif fixture into an explanation row", () => {
    const fork = LICHESS_MOTIF_FIXTURES.find((row) =>
      row.themes.includes("fork"),
    );
    expect(fork).toBeDefined();
    const scenarios = puzzleToScenarios(fork!);
    expect(scenarios.length).toBeGreaterThan(0);
    const row = dumpScenario(scenarios[0]!);
    expect(row?.explanation.length).toBeGreaterThan(10);
    expect(row?.playedUci).toBe(fork!.move);
  });
});
