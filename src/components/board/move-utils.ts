import {
  type GameMove,
  getLegalMoves,
  type PieceSymbol,
  parseUci,
} from "@/domain/game";

export type BoardMove = {
  from: string;
  to: string;
  promotion?: PieceSymbol;
};

/** True when the only legal ways to reach `to` from `from` are promotions. */
export function moveRequiresPromotion(
  fen: string,
  from: string,
  to: string,
): boolean {
  const matches = getLegalMoves(fen, from).filter((move) => move.to === to);
  return matches.length > 0 && matches.every((move) => Boolean(move.promotion));
}

export function legalDestinations(fen: string, from: string): string[] {
  return getLegalMoves(fen, from).map((move) => move.to);
}

export function findMove(
  fen: string,
  from: string,
  to: string,
  promotion?: PieceSymbol,
): GameMove | null {
  const matches = getLegalMoves(fen, from).filter((move) => move.to === to);
  if (matches.length === 0) return null;
  if (promotion) {
    return matches.find((move) => move.promotion === promotion) ?? null;
  }
  return matches.find((move) => !move.promotion) ?? matches[0] ?? null;
}

/** From/to squares for a UCI move, or null when the string is not a move. */
export function lastMoveSquares(
  uci: string | null | undefined,
): { from: string; to: string } | null {
  if (!uci) return null;
  const parsed = parseUci(uci);
  return parsed ? { from: parsed.from, to: parsed.to } : null;
}

export const PROMOTION_PIECES: PieceSymbol[] = ["q", "r", "b", "n"];
