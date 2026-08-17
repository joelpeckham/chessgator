#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
/**
 * Fetch Lichess CC0 chess-openings TSVs and emit src/app/openings/data/openings.json.
 * Source: https://github.com/lichess-org/chess-openings (CC0)
 */
import { Chess } from "chess.js";

const SOURCE =
  "https://raw.githubusercontent.com/lichess-org/chess-openings/master";
const ECO_FILES = ["a", "b", "c", "d", "e"] as const;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/app/openings/data/openings.json",
);

export type RawOpeningRow = {
  eco: string;
  name: string;
  pgn: string;
};

export type PreparedOpening = {
  eco: string;
  name: string;
  pgn: string;
  moves: string[];
  slug: string;
  firstMove: string;
  fen: string | null;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

export function parsePgnMoves(pgn: string): string[] {
  return pgn
    .replace(/\d+\.+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((move) => move.length > 0);
}

export function fenForMoves(moves: readonly string[]): string | null {
  const chess = new Chess();
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      return null;
    }
  }
  return chess.fen();
}

export function assignSlugs(rows: readonly RawOpeningRow[]): PreparedOpening[] {
  const used = new Map<string, number>();
  const result: PreparedOpening[] = [];

  for (const row of rows) {
    const moves = parsePgnMoves(row.pgn);
    const firstMove = moves[0] ?? "";
    const base = slugify(row.name) || "opening";
    let slug = base;
    const ecoSuffix = row.eco.toLowerCase();

    if (used.has(slug)) {
      slug = `${base}-${ecoSuffix}`;
    }
    if (used.has(slug)) {
      slug = `${base}-${ecoSuffix}-${shortHash(row.pgn)}`;
    }

    let n = used.get(slug) ?? 0;
    while (n > 0) {
      slug = `${base}-${ecoSuffix}-${shortHash(`${row.pgn}-${n}`)}`;
      n = used.get(slug) ?? 0;
    }
    used.set(slug, (used.get(slug) ?? 0) + 1);

    result.push({
      eco: row.eco,
      name: row.name,
      pgn: row.pgn,
      moves,
      slug,
      firstMove,
      fen: fenForMoves(moves),
    });
  }

  return result;
}

function parseTsv(text: string): RawOpeningRow[] {
  const lines = text.trim().split("\n");
  const rows: RawOpeningRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const eco = line.slice(0, tab);
    const rest = line.slice(tab + 1);
    const tab2 = rest.indexOf("\t");
    if (tab2 === -1) continue;
    rows.push({
      eco,
      name: rest.slice(0, tab2),
      pgn: rest.slice(tab2 + 1),
    });
  }
  return rows;
}

async function fetchTsv(letter: string): Promise<string> {
  const res = await fetch(`${SOURCE}/${letter}.tsv`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${letter}.tsv: ${res.status}`);
  }
  return res.text();
}

async function main(): Promise<void> {
  const allRows: RawOpeningRow[] = [];
  for (const letter of ECO_FILES) {
    const text = await fetchTsv(letter);
    const rows = parseTsv(text);
    console.log(`${letter}.tsv: ${rows.length} openings`);
    allRows.push(...rows);
  }

  const openings = assignSlugs(allRows);
  const invalid = openings.filter((o) => !o.fen).length;
  if (invalid > 0) {
    console.warn(`Warning: ${invalid} openings have illegal move sequences`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), source: SOURCE, count: openings.length, openings }, null, 0)}\n`,
  );
  console.log(`Wrote ${openings.length} openings to ${OUT}`);
}

const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  await main();
}
