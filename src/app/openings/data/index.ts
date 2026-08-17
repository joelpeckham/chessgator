import raw from "./openings.json";

export type OpeningRecord = {
  eco: string;
  name: string;
  pgn: string;
  moves: string[];
  slug: string;
  firstMove: string;
  fen: string | null;
};

type OpeningsDataset = {
  generatedAt: string;
  source: string;
  count: number;
  openings: OpeningRecord[];
};

const dataset = raw as OpeningsDataset;

export const OPENINGS_SOURCE = dataset.source;
export const OPENINGS: readonly OpeningRecord[] = dataset.openings;

const bySlug = new Map<string, OpeningRecord>();
const byEcoLetter = new Map<string, OpeningRecord[]>();
const byFirstMove = new Map<string, OpeningRecord[]>();

for (const opening of OPENINGS) {
  bySlug.set(opening.slug, opening);

  const letter = opening.eco.charAt(0).toUpperCase();
  const ecoGroup = byEcoLetter.get(letter) ?? [];
  ecoGroup.push(opening);
  byEcoLetter.set(letter, ecoGroup);

  const moveGroup = byFirstMove.get(opening.firstMove) ?? [];
  moveGroup.push(opening);
  byFirstMove.set(opening.firstMove, moveGroup);
}

for (const group of byEcoLetter.values()) {
  group.sort(
    (a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name),
  );
}
for (const group of byFirstMove.values()) {
  group.sort(
    (a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name),
  );
}

export const ECO_LETTERS = ["A", "B", "C", "D", "E"] as const;
export type EcoLetter = (typeof ECO_LETTERS)[number];

export function getOpeningBySlug(slug: string): OpeningRecord | undefined {
  return bySlug.get(slug);
}

export function getOpeningsByEcoLetter(
  letter: string,
): readonly OpeningRecord[] {
  return byEcoLetter.get(letter.toUpperCase()) ?? [];
}

export function getOpeningsByFirstMove(move: string): readonly OpeningRecord[] {
  return byFirstMove.get(firstMoveFromSlug(move)) ?? [];
}

export function allOpeningSlugs(): string[] {
  return OPENINGS.map((o) => o.slug);
}

/** URL segment for a first-move hub (lowercase SAN). */
export function firstMoveToSlug(move: string): string {
  return move.toLowerCase();
}

/** Decode a first-move hub segment back to dataset firstMove key. */
export function firstMoveFromSlug(slug: string): string {
  const lower = slug.toLowerCase();
  for (const move of byFirstMove.keys()) {
    if (move.toLowerCase() === lower) return move;
  }
  return slug;
}

export function allFirstMoveSlugs(): string[] {
  const slugs = new Set<string>();
  for (const move of byFirstMove.keys()) {
    slugs.add(firstMoveToSlug(move));
  }
  return [...slugs].toSorted((a, b) => a.localeCompare(b));
}

const POPULAR_PREFIXES = [
  "Sicilian Defense",
  "French Defense",
  "Caro-Kann Defense",
  "Scandinavian Defense",
  "Ruy Lopez",
  "Italian Game",
  "Queen's Gambit",
  "King's Indian Defense",
  "Nimzo-Indian Defense",
  "Queen's Indian Defense",
  "English Opening",
  "Grünfeld Defense",
  "Slav Defense",
  "Catalan Opening",
  "Dutch Defense",
  "Vienna Game",
  "Scotch Game",
  "Petrov's Defense",
  "Philidor Defense",
  "Alekhine Defense",
  "Pirc Defense",
  "Modern Defense",
  "Benoni Defense",
  "Benko Gambit",
  "London System",
  "Colle System",
  "Réti Opening",
  "Bird Opening",
  "King's Gambit",
  "Italian Game: Evans Gambit",
  "Italian Game: Two Knights Defense",
  "Four Knights Game",
  "Bishop's Opening",
  "Center Game",
  "Danish Gambit",
  "Indian Defense: Budapest Gambit",
  "Trompowsky Attack",
  "Clemenz Opening",
  "Polish Opening",
  "Latvian Gambit",
] as const;

/** One representative line per well-known opening family for the hub. */
export function popularOpenings(): OpeningRecord[] {
  const seen = new Set<string>();
  const result: OpeningRecord[] = [];

  for (const prefix of POPULAR_PREFIXES) {
    const match =
      OPENINGS.find((o) => o.name === prefix) ??
      OPENINGS.find((o) => o.name.startsWith(`${prefix}:`));
    if (!match) {
      throw new Error(`No opening matches popular prefix "${prefix}"`);
    }
    if (!seen.has(match.slug)) {
      seen.add(match.slug);
      result.push(match);
    }
  }

  return result;
}
