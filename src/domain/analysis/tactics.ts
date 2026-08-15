import { Chess, type Color, type Square } from "chess.js";
import type { MoveEffects } from "@/domain/analysis/move-effects";
import { isHangingBySee } from "@/domain/analysis/see";
import { findKingOnChess } from "@/domain/game";
import type { GameMove } from "@/domain/game/types";

/**
 * Basic tactical facts from chess.js — explicit, testable, no engine needed.
 */
export type TacticalFacts = {
  gaveCheck: boolean;
  isCapture: boolean;
  isPromotion: boolean;
  /** The piece that moved lands on a square attacked by the opponent and not defended. */
  movedPieceHanging: boolean;
  /** Some other own piece is hanging after the move (attacked, under-defended). */
  leftPieceHanging: boolean;
  /** Captured a piece that was hanging before the move. */
  capturedHangingPiece: boolean;
  /** Opponent had a capture threat that this move did not address (still hanging after). */
  ignoredThreat: boolean;
  /** Minor/major piece left the back rank to a developing square. */
  developedPiece: boolean;
  /** King lost castling rights by moving / not castling when available, rough signal. */
  castlingRightsLost: boolean;
  /** King is more exposed: more enemy attacks on adjacent squares after the move. */
  kingMoreExposed: boolean;
  hangingSquares: string[];
};

export type TacticalFactsInput = {
  fenBefore: string;
  move: GameMove;
  fenAfter: string;
};

export function tacticalFactsFromEffects(effects: MoveEffects): TacticalFacts {
  const hangingSquares = [
    ...(effects.movedPieceHanging
      ? [effects.movedPieceHanging.piece.square]
      : []),
    ...effects.newlyHanging.map((unit) => unit.piece.square),
    ...effects.ignoredThreats.map((unit) => unit.piece.square),
  ];
  return {
    gaveCheck: effects.gaveCheck,
    isCapture: Boolean(effects.captured),
    isPromotion: Boolean(effects.move.promotion),
    movedPieceHanging: effects.movedPieceHanging != null,
    leftPieceHanging: effects.newlyHanging.length > 0,
    capturedHangingPiece: Boolean(
      effects.captured && effects.capturedSeeCp > 0,
    ),
    ignoredThreat: effects.ignoredThreats.length > 0,
    developedPiece: effects.developedPiece,
    castlingRightsLost: effects.castlingRightsLost,
    kingMoreExposed: effects.kingMoreExposed,
    hangingSquares: [...new Set(hangingSquares)],
  };
}

/** Squares occupied by `color` pieces that are hanging (SEE-lite). */
export function hangingSquaresFor(chess: Chess, color: Color): string[] {
  const hanging: string[] = [];
  const board = chess.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== color || piece.type === "k") continue;
      const square = (String.fromCharCode(97 + file) +
        String(8 - rank)) as Square;
      if (isHangingOn(chess, square, color)) {
        hanging.push(square);
      }
    }
  }
  return hanging;
}

/**
 * A piece is hanging when capturing it wins material by static exchange.
 * Deliberately turn-independent (uses attack maps, not side-to-move legal moves).
 */
export function isHangingOn(
  chess: Chess,
  square: Square,
  owner: Color,
): boolean {
  return isHangingBySee(chess, square, owner);
}

/** Count enemy attacks on squares adjacent to the king (including the king sq). */
export function kingExposure(chess: Chess, color: Color): number {
  const kingSq = findKingOnChess(chess, color);
  if (!kingSq) return 0;
  const opponent: Color = color === "w" ? "b" : "w";
  let count = 0;
  for (const sq of adjacentSquares(kingSq)) {
    if (chess.isAttacked(sq, opponent)) count += 1;
  }
  if (chess.isAttacked(kingSq, opponent)) count += 2;
  return count;
}

function adjacentSquares(square: Square): Square[] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 1 || r > 8) continue;
      out.push((String.fromCharCode(97 + f) + String(r)) as Square);
    }
  }
  return out;
}
