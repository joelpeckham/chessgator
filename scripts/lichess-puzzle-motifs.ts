#!/usr/bin/env bun
/**
 * Report motif-detector precision/recall on curated fixtures, plus the
 * cached Lichess sample when present. The full dump is not fetched in CI.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatMotifReport,
  LICHESS_MOTIF_FIXTURES,
  type PuzzleFixture,
  reportMotifPrecision,
} from "../src/domain/analysis/motif-precision";

const SAMPLE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "lichess-puzzles.sample.json",
);

const sample = await loadSample();
const fixtures = [...LICHESS_MOTIF_FIXTURES, ...sample];
const reports = reportMotifPrecision(fixtures);
console.log(
  `fixtures: ${LICHESS_MOTIF_FIXTURES.length} curated + ${sample.length} sample`,
);
console.log(formatMotifReport(reports));

async function loadSample(): Promise<PuzzleFixture[]> {
  try {
    const raw = await readFile(SAMPLE_PATH, "utf8");
    return JSON.parse(raw) as PuzzleFixture[];
  } catch {
    return [];
  }
}
