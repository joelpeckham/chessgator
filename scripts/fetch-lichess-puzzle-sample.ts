#!/usr/bin/env bun
/**
 * Stream a slice of the public Lichess puzzle dump and cache ~200 tagged
 * puzzles for offline motif precision + coaching dumps. Not used at runtime.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type {
  LichessTheme,
  PuzzleFixture,
} from "../src/domain/analysis/motif-precision";
import { tryApplyMove } from "../src/domain/game/rules";

const THEMES: readonly LichessTheme[] = [
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "backRankMate",
  "trappedPiece",
];
const PER_THEME = 34;
const MAX_SCAN = 80_000;
const SOURCE = "https://database.lichess.org/lichess_db_puzzle.csv.zst";
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "lichess-puzzles.sample.json",
);

async function main(): Promise<void> {
  const buckets = new Map<LichessTheme, PuzzleFixture[]>(
    THEMES.map((theme) => [theme, []]),
  );
  let scanned = 0;
  const stream = streamPuzzleLines();
  for await (const line of stream.lines) {
    if (line.startsWith("PuzzleId")) continue;
    const row = parsePuzzleLine(line);
    if (!row) continue;
    scanned += 1;
    if (scanned >= MAX_SCAN) break;
    const theme = THEMES.find(
      (name) =>
        row.themes.includes(name) &&
        (buckets.get(name)?.length ?? 0) < PER_THEME,
    );
    if (!theme) {
      if (
        THEMES.every((name) => (buckets.get(name)?.length ?? 0) >= PER_THEME)
      ) {
        break;
      }
      continue;
    }
    buckets.get(theme)?.push(row);
  }
  stream.stop();

  const sample = THEMES.flatMap((theme) => buckets.get(theme) ?? []);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(sample, null, 2)}\n`);
  console.log(`wrote ${sample.length} puzzles (${scanned} kept) → ${OUT}`);
  for (const theme of THEMES) {
    console.log(`  ${theme}: ${buckets.get(theme)?.length ?? 0}`);
  }
}

function parsePuzzleLine(line: string): PuzzleFixture | null {
  const parts = line.split(",");
  const id = parts[0];
  const fenBefore = parts[1];
  const movesRaw = parts[2];
  const themesRaw = parts[7];
  if (!id || !fenBefore || !movesRaw || !themesRaw) return null;
  const moves = movesRaw.trim().split(/\s+/);
  const setup = moves[0];
  const solution = moves[1];
  if (!setup || !solution) return null;
  const applied = tryApplyMove(fenBefore, setup);
  if (!applied) return null;
  if (!tryApplyMove(applied.fenAfter, solution)) return null;
  const themes = themesRaw
    .trim()
    .split(/\s+/)
    .filter((theme): theme is LichessTheme =>
      (THEMES as readonly string[]).includes(theme),
    );
  if (themes.length === 0) return null;
  return { id, fen: applied.fenAfter, move: solution, themes };
}

function streamPuzzleLines(): {
  lines: AsyncGenerator<string>;
  stop: () => void;
} {
  const proc = spawn(
    "sh",
    ["-c", `curl -sL --max-time 180 "${SOURCE}" | zstd -dc`],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const stop = (): void => {
    proc.kill("SIGTERM");
  };
  async function* lines(): AsyncGenerator<string> {
    const reader = createInterface({ input: proc.stdout });
    for await (const line of reader) {
      yield line;
    }
  }
  return { lines: lines(), stop };
}

await main();
