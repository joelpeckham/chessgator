import {
  DEFAULT_POSITION,
  sideToMoveFromFen,
  tryApplyMove,
  validateLegalUci,
} from "@/domain/game";

/**
 * Hand-curated replies for the landing-page demo so the board answers
 * instantly while Maia downloads in the background. Lines are SAN from the
 * standard start; `replies` are Black's candidate answers to the position
 * reached after the last White move in `line`.
 */
export type HeroBookLine = {
  line: readonly string[];
  replies: readonly string[];
};

export const HERO_BOOK_LINES: readonly HeroBookLine[] = [
  // 1. e4
  { line: ["e4"], replies: ["e5", "c5", "e6"] },
  { line: ["e4", "e5", "Nf3"], replies: ["Nc6"] },
  { line: ["e4", "e5", "Nf3", "Nc6", "Bc4"], replies: ["Bc5", "Nf6"] },
  { line: ["e4", "e5", "Nf3", "Nc6", "Bb5"], replies: ["a6"] },
  { line: ["e4", "e5", "Nf3", "Nc6", "d4"], replies: ["exd4"] },
  { line: ["e4", "e5", "Nf3", "Nc6", "Nc3"], replies: ["Nf6"] },
  { line: ["e4", "e5", "Bc4"], replies: ["Nf6", "Nc6"] },
  // Scholar's-mate tries get a calm defense, not a free win.
  { line: ["e4", "e5", "Bc4", "Nc6", "Qh5"], replies: ["g6"] },
  { line: ["e4", "e5", "Qh5"], replies: ["Nc6"] },
  { line: ["e4", "e5", "Qh5", "Nc6", "Bc4"], replies: ["g6"] },
  { line: ["e4", "e5", "Nc3"], replies: ["Nf6"] },
  { line: ["e4", "e5", "d4"], replies: ["exd4"] },
  { line: ["e4", "e5", "f4"], replies: ["exf4"] },
  { line: ["e4", "c5", "Nf3"], replies: ["d6", "Nc6", "e6"] },
  { line: ["e4", "c5", "Nc3"], replies: ["Nc6"] },
  { line: ["e4", "c5", "d4"], replies: ["cxd4"] },
  { line: ["e4", "e6", "d4"], replies: ["d5"] },
  { line: ["e4", "e6", "Nf3"], replies: ["d5"] },
  // 1. d4
  { line: ["d4"], replies: ["d5", "Nf6"] },
  { line: ["d4", "d5", "c4"], replies: ["e6", "c6"] },
  { line: ["d4", "d5", "Nf3"], replies: ["Nf6", "e6"] },
  { line: ["d4", "d5", "Bf4"], replies: ["Nf6"] },
  { line: ["d4", "Nf6", "c4"], replies: ["e6", "g6"] },
  { line: ["d4", "Nf6", "Nf3"], replies: ["d5", "e6"] },
  { line: ["d4", "Nf6", "Bf4"], replies: ["d5"] },
  // 1. Nf3
  { line: ["Nf3"], replies: ["d5", "Nf6"] },
  { line: ["Nf3", "d5", "d4"], replies: ["Nf6"] },
  { line: ["Nf3", "d5", "c4"], replies: ["e6", "c6"] },
  { line: ["Nf3", "Nf6", "c4"], replies: ["e6", "g6"] },
  { line: ["Nf3", "Nf6", "d4"], replies: ["d5", "e6"] },
  // 1. c4
  { line: ["c4"], replies: ["e5", "Nf6", "c5"] },
  { line: ["c4", "e5", "Nc3"], replies: ["Nf6"] },
  { line: ["c4", "Nf6", "Nc3"], replies: ["e5", "e6"] },
  { line: ["c4", "Nf6", "d4"], replies: ["e6", "g6"] },
];

/** Move legality does not depend on the clock fields, so drop them. */
function bookKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function buildHeroBook(): Map<string, readonly string[]> {
  const book = new Map<string, string[]>();
  for (const { line, replies } of HERO_BOOK_LINES) {
    let fen: string | null = DEFAULT_POSITION;
    for (const san of line) {
      if (fen === null) break;
      fen = tryApplyMove(fen, san)?.fenAfter ?? null;
    }
    if (!fen) continue;
    const positionFen = fen;
    const uciReplies = replies
      .map((san) => tryApplyMove(positionFen, san)?.move.uci ?? null)
      .filter((uci): uci is string => uci !== null);
    if (uciReplies.length > 0) book.set(bookKey(positionFen), uciReplies);
  }
  return book;
}

const HERO_BOOK = buildHeroBook();

/**
 * Instant Black reply for the hero demo, or null when the position is out of
 * book and Maia should take over. Any unknown first White move gets ...d5,
 * which is always legal after one White move.
 */
export function pickBookReply(
  fen: string,
  random: () => number = Math.random,
): string | null {
  if (sideToMoveFromFen(fen) !== "b") return null;

  const replies = HERO_BOOK.get(bookKey(fen));
  if (replies && replies.length > 0) {
    const index = Math.min(
      replies.length - 1,
      Math.floor(random() * replies.length),
    );
    return validateLegalUci(fen, replies[index]);
  }

  const fullmove = fen.split(" ")[5];
  if (fullmove === "1") return validateLegalUci(fen, "d7d5");
  return null;
}
