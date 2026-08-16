import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import {
  type NamedUnit,
  namedUnitAt,
  oppositeColor,
  PIECE_VALUE_CP,
} from "@/domain/analysis/board-units";

/**
 * Static exchange evaluation: centipawns gained by `side` if they capture
 * on `square` now, assuming both sides recapture with the least valuable
 * piece and may stand pat. 0 means they cannot (or would not) win material.
 */
export function seeGainCp(chess: Chess, square: Square, side: Color): number {
  const victim = chess.get(square);
  if (!victim || victim.color === side) return 0;
  if (!chess.isAttacked(square, side)) return 0;
  const board = new Chess(chess.fen());
  return seeRecurse(board, square, side);
}

/**
 * SEE for a completed capture. En passant lands on an empty square, so the
 * usual "is this square attacked?" check against the captured pawn fails.
 */
export function seeGainForCapture(
  chess: Chess,
  move: { from: string; to: string; piece: PieceSymbol; color: Color },
  capturedSquare: Square,
): number {
  const isEnPassant =
    move.piece === "p" &&
    move.from[0] !== move.to[0] &&
    !chess.get(move.to as Square);
  if (!isEnPassant) {
    return seeGainCp(chess, capturedSquare, move.color);
  }
  const board = new Chess(chess.fen());
  try {
    board.move({ from: move.from, to: move.to });
  } catch {
    return PIECE_VALUE_CP.p;
  }
  const recapture = seeGainCp(
    board,
    move.to as Square,
    oppositeColor(move.color),
  );
  return Math.max(0, PIECE_VALUE_CP.p - recapture);
}

/** True when the opponent wins material by capturing on this square. */
export function isHangingBySee(
  chess: Chess,
  square: Square,
  owner: Color,
): boolean {
  const piece = chess.get(square);
  if (!piece || piece.color !== owner || piece.type === "k") return false;
  return seeGainCp(chess, square, oppositeColor(owner)) > 0;
}

export function cheapestAttacker(
  chess: Chess,
  square: Square,
  by: Color,
): NamedUnit | null {
  return leastValuableAttacker(chess, square, by);
}

function seeRecurse(board: Chess, square: Square, side: Color): number {
  const attacker = leastValuableAttacker(board, square, side);
  if (!attacker) return 0;
  const victim = board.get(square);
  if (!victim) return 0;
  const value = PIECE_VALUE_CP[victim.type];
  applySeeCapture(board, attacker, square);
  const recapture = seeRecurse(board, square, oppositeColor(side));
  return Math.max(0, value - recapture);
}

function leastValuableAttacker(
  chess: Chess,
  square: Square,
  side: Color,
): NamedUnit | null {
  let best: NamedUnit | null = null;
  for (const sq of chess.attackers(square, side)) {
    const unit = namedUnitAt(chess, sq);
    if (!unit || unit.color !== side) continue;
    if (unit.type === "k" && kingCaptureUnsafe(chess, square, side)) {
      continue;
    }
    if (!best || PIECE_VALUE_CP[unit.type] < PIECE_VALUE_CP[best.type]) {
      best = unit;
    }
  }
  return best;
}

function kingCaptureUnsafe(chess: Chess, square: Square, side: Color): boolean {
  const victim = chess.get(square);
  if (victim) chess.remove(square);
  const unsafe = chess.isAttacked(square, oppositeColor(side));
  if (victim) chess.put(victim, square);
  return unsafe;
}

function applySeeCapture(board: Chess, attacker: NamedUnit, to: Square): void {
  const piece = board.get(attacker.square);
  board.remove(attacker.square);
  board.remove(to);
  if (!piece) return;
  const placed: { type: PieceSymbol; color: Color } =
    piece.type === "p" && (to.endsWith("8") || to.endsWith("1"))
      ? { type: "q", color: piece.color }
      : piece;
  board.put(placed, to);
}
