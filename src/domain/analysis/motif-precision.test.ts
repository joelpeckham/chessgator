import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatMotifReport,
  LICHESS_MOTIF_FIXTURES,
  type PuzzleFixture,
  reportMotifPrecision,
} from "@/domain/analysis/motif-precision";

describe("lichess motif precision", () => {
  it("recalls the tagged theme on curated fixtures", () => {
    const reports = reportMotifPrecision();
    for (const row of reports) {
      expect(row.recall, `${row.theme} recall`).toBeGreaterThanOrEqual(0.5);
      expect(row.precision, `${row.theme} precision`).toBeGreaterThanOrEqual(
        0.5,
      );
    }
    expect(formatMotifReport(reports).length).toBeGreaterThan(20);
  });

  it("stays above floor on the cached Lichess sample", () => {
    const raw = readFileSync(
      new URL(
        "../../../scripts/fixtures/lichess-puzzles.sample.json",
        import.meta.url,
      ),
      "utf8",
    );
    const sample = JSON.parse(raw) as PuzzleFixture[];
    const reports = reportMotifPrecision([
      ...LICHESS_MOTIF_FIXTURES,
      ...sample,
    ]);
    for (const row of reports) {
      expect(row.recall, `${row.theme} recall`).toBeGreaterThanOrEqual(0.5);
      expect(row.precision, `${row.theme} precision`).toBeGreaterThanOrEqual(
        0.4,
      );
    }
  });
});
