import { type GameMove, getLegalMoves, type PieceSymbol } from "@/domain/game";

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

export const PROMOTION_PIECES: PieceSymbol[] = ["q", "r", "b", "n"];
