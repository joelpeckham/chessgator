#!/usr/bin/env bun
/**
 * Generate coaching explanations for stub, motif, and Lichess-sample
 * scenarios. Offline only — input for Luna QA, not shipped to the app.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LICHESS_MOTIF_FIXTURES,
  type PuzzleFixture,
} from "../src/domain/analysis/motif-precision";
import {
  dumpScenario,
  puzzleToScenarios,
} from "../src/domain/teaching/coaching-dump";
import { defaultStubScripts } from "../src/features/game/stub-analysis";

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = join(here, "fixtures", "lichess-puzzles.sample.json");
const OUT = join(here, "fixtures", "coaching-dump.json");

async function main(): Promise<void> {
  const rows = [];
  for (const scenario of stubScenarios()) {
    const row = dumpScenario(scenario);
    if (row) rows.push(row);
  }
  for (const puzzle of [...LICHESS_MOTIF_FIXTURES, ...(await loadSample())]) {
    for (const scenario of puzzleToScenarios(puzzle)) {
      const row = dumpScenario(scenario);
      if (row) rows.push(row);
    }
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`wrote ${rows.length} explanations → ${OUT}`);
}

function stubScenarios() {
  return defaultStubScripts().flatMap((script, index) => {
    const best = script.evidence.bestMoveUci;
    if (!best) return [];
    const second = script.evidence.lines[1]?.pvUci[0];
    const afterScore = script.evidence.score;
    const before = {
      score: script.evidence.score,
      bestMoveUci: best,
      lines: script.evidence.lines,
    };
    const rows = [
      {
        id: `stub-${index}:best`,
        fen: script.fen,
        playedUci: best,
        before,
        after: {
          score: afterScore,
          bestMoveUci: best,
          lines: [{ multipv: 1, score: afterScore, pvUci: [best] }],
        },
      },
    ];
    if (second && second !== best) {
      rows.push({
        id: `stub-${index}:alt`,
        fen: script.fen,
        playedUci: second,
        before,
        after: {
          score: { cp: -80 },
          bestMoveUci: best,
          lines: [{ multipv: 1, score: afterScore, pvUci: [best] }],
        },
      });
    }
    return rows;
  });
}

async function loadSample(): Promise<PuzzleFixture[]> {
  try {
    const raw = await readFile(SAMPLE_PATH, "utf8");
    return JSON.parse(raw) as PuzzleFixture[];
  } catch {
    return [];
  }
}

await main();
