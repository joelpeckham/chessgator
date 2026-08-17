import type { OpeningRecord } from "./data";

/** First-move hubs linked from the main openings index. */
export const FEATURED_FIRST_MOVES = [
  "e4",
  "d4",
  "c4",
  "nf3",
  "g3",
  "b3",
  "f4",
  "nc3",
] as const;

export type FeaturedFirstMove = (typeof FEATURED_FIRST_MOVES)[number];

export function isFeaturedFirstMove(slug: string): slug is FeaturedFirstMove {
  return (FEATURED_FIRST_MOVES as readonly string[]).includes(slug);
}

export function featuredFirstMoveLabel(slug: FeaturedFirstMove): string {
  const labels: Record<FeaturedFirstMove, string> = {
    e4: "1. e4",
    d4: "1. d4",
    c4: "1. c4",
    nf3: "1. Nf3",
    g3: "1. g3",
    b3: "1. b3",
    f4: "1. f4",
    nc3: "1. Nc3",
  };
  return labels[slug];
}

export function openingMatchesFeaturedFirstMove(
  opening: OpeningRecord,
  slug: FeaturedFirstMove,
): boolean {
  return opening.firstMove.toLowerCase() === slug;
}
