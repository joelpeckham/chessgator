import { Chess, type Color, type Square } from "chess.js";
import {
  ALL_SQUARES,
  allPieces,
  fileIndex,
  namedUnitAt,
  oppositeColor,
  PIECE_VALUE_CP,
  rankIndex,
  squareFrom,
} from "@/domain/analysis/board-units";
import { findKingOnChess } from "@/domain/game";

export type GamePhase = "opening" | "middlegame" | "endgame";

export type StructureDelta = {
  doubledPawnsCreated: number;
  isolatedPawnsCreated: number;
  backwardPawnsCreated: number;
  gainedOpenFile: boolean;
  gainedSemiOpenFile: boolean;
  rookReachedSeventh: boolean;
  knightReachedOutpost: boolean;
  pawnShieldDamage: number;
  mobilityDelta: number;
};

export function detectGamePhase(chess: Chess): GamePhase {
  const parts = chess.fen().split(" ");
  const moveNumber = Number(parts[5] ?? "1");
  let nonPawn = 0;
  let queens = 0;
  for (const unit of allPieces(chess)) {
    if (unit.type === "k" || unit.type === "p") continue;
    nonPawn += PIECE_VALUE_CP[unit.type];
    if (unit.type === "q") queens += 1;
  }
  if (nonPawn <= 1300 || (queens === 0 && nonPawn <= 1600)) {
    return "endgame";
  }
  if (moveNumber <= 12 && nonPawn >= 5800) return "opening";
  return "middlegame";
}

export function collectStructureDelta(
  before: Chess,
  after: Chess,
  mover: Color,
): StructureDelta {
  const doubledBefore = doubledFileCount(before, mover);
  const doubledAfter = doubledFileCount(after, mover);
  const isolatedBefore = isolatedPawns(before, mover).length;
  const isolatedAfter = isolatedPawns(after, mover).length;
  const backwardBefore = backwardPawns(before, mover).length;
  const backwardAfter = backwardPawns(after, mover).length;

  return {
    doubledPawnsCreated: Math.max(0, doubledAfter - doubledBefore),
    isolatedPawnsCreated: Math.max(0, isolatedAfter - isolatedBefore),
    backwardPawnsCreated: Math.max(0, backwardAfter - backwardBefore),
    gainedOpenFile:
      rookOnOpenFile(after, mover) && !rookOnOpenFile(before, mover),
    gainedSemiOpenFile:
      rookOnSemiOpenFile(after, mover) && !rookOnSemiOpenFile(before, mover),
    rookReachedSeventh:
      hasRookOnSeventh(after, mover) && !hasRookOnSeventh(before, mover),
    knightReachedOutpost:
      outpostKnights(after, mover).length >
      outpostKnights(before, mover).length,
    pawnShieldDamage: Math.max(
      0,
      pawnShield(before, mover) - pawnShield(after, mover),
    ),
    mobilityDelta:
      attackedSquareCount(after, mover) - attackedSquareCount(before, mover),
  };
}

function pawnsOnFile(chess: Chess, color: Color, file: number): number {
  let n = 0;
  for (let rank = 1; rank <= 8; rank += 1) {
    const sq = squareFrom(file, rank);
    if (!sq) continue;
    const occ = chess.get(sq);
    if (occ?.type === "p" && occ.color === color) n += 1;
  }
  return n;
}

function doubledFileCount(chess: Chess, color: Color): number {
  let n = 0;
  for (let file = 0; file < 8; file += 1) {
    if (pawnsOnFile(chess, color, file) >= 2) n += 1;
  }
  return n;
}

function isolatedPawns(chess: Chess, color: Color): Square[] {
  const isolated: Square[] = [];
  for (const unit of allPieces(chess)) {
    if (unit.color !== color || unit.type !== "p") continue;
    const file = fileIndex(unit.square);
    const left = file > 0 ? pawnsOnFile(chess, color, file - 1) : 0;
    const right = file < 7 ? pawnsOnFile(chess, color, file + 1) : 0;
    if (left === 0 && right === 0) isolated.push(unit.square);
  }
  return isolated;
}

function backwardPawns(chess: Chess, color: Color): Square[] {
  const enemy = oppositeColor(color);
  const dir = color === "w" ? 1 : -1;
  const out: Square[] = [];
  for (const unit of allPieces(chess)) {
    if (unit.color !== color || unit.type !== "p") continue;
    const file = fileIndex(unit.square);
    const rank = rankIndex(unit.square);
    const stop = squareFrom(file, rank + dir);
    if (!stop) continue;
    if (chess.get(stop)) continue;
    const stopAttackedByEnemyPawn = isPawnAttackedBy(chess, stop, enemy);
    const supported = isPawnAttackedBy(chess, unit.square, color);
    if (stopAttackedByEnemyPawn && !supported) out.push(unit.square);
  }
  return out;
}

function isPawnAttackedBy(chess: Chess, square: Square, by: Color): boolean {
  const file = fileIndex(square);
  const rank = rankIndex(square);
  const fromRank = by === "w" ? rank - 1 : rank + 1;
  for (const df of [-1, 1]) {
    const sq = squareFrom(file + df, fromRank);
    if (!sq) continue;
    const occ = chess.get(sq);
    if (occ?.type === "p" && occ.color === by) return true;
  }
  return false;
}

function fileHasPawn(chess: Chess, file: number, color?: Color): boolean {
  for (let rank = 1; rank <= 8; rank += 1) {
    const sq = squareFrom(file, rank);
    if (!sq) continue;
    const occ = chess.get(sq);
    if (occ?.type === "p" && (color === undefined || occ.color === color)) {
      return true;
    }
  }
  return false;
}

function rookOnOpenFile(chess: Chess, color: Color): boolean {
  for (const unit of allPieces(chess)) {
    if (unit.color !== color || unit.type !== "r") continue;
    const file = fileIndex(unit.square);
    if (!fileHasPawn(chess, file)) return true;
  }
  return false;
}

function rookOnSemiOpenFile(chess: Chess, color: Color): boolean {
  const enemy = oppositeColor(color);
  for (const unit of allPieces(chess)) {
    if (unit.color !== color || unit.type !== "r") continue;
    const file = fileIndex(unit.square);
    if (fileHasPawn(chess, file, color)) continue;
    if (fileHasPawn(chess, file, enemy)) return true;
  }
  return false;
}

function hasRookOnSeventh(chess: Chess, color: Color): boolean {
  const rank = color === "w" ? 7 : 2;
  return allPieces(chess).some(
    (unit) =>
      unit.color === color &&
      unit.type === "r" &&
      rankIndex(unit.square) === rank,
  );
}

function outpostKnights(chess: Chess, color: Color): Square[] {
  const enemy = oppositeColor(color);
  const out: Square[] = [];
  for (const unit of allPieces(chess)) {
    if (unit.color !== color || unit.type !== "n") continue;
    const rank = rankIndex(unit.square);
    const advanced = color === "w" ? rank >= 4 : rank <= 5;
    if (!advanced) continue;
    if (!isPawnAttackedBy(chess, unit.square, color)) continue;
    if (enemyPawnCanAttack(chess, unit.square, enemy)) continue;
    out.push(unit.square);
  }
  return out;
}

function enemyPawnCanAttack(
  chess: Chess,
  square: Square,
  enemy: Color,
): boolean {
  const file = fileIndex(square);
  const rank = rankIndex(square);
  const dir = enemy === "w" ? 1 : -1;
  // An enemy pawn currently on a neighboring file, behind the outpost,
  // could step forward and attack it.
  for (const df of [-1, 1]) {
    for (let r = rank - dir; r >= 1 && r <= 8; r -= dir) {
      const sq = squareFrom(file + df, r);
      if (!sq) continue;
      const occ = chess.get(sq);
      if (occ?.type === "p" && occ.color === enemy) return true;
      if (occ) break;
    }
  }
  return false;
}

function pawnShield(chess: Chess, color: Color): number {
  const kingSq = findKingOnChess(chess, color);
  if (!kingSq) return 0;
  const file = fileIndex(kingSq);
  const rank = rankIndex(kingSq);
  const dir = color === "w" ? 1 : -1;
  let n = 0;
  for (const df of [-1, 0, 1]) {
    for (const dr of [1, 2]) {
      const sq = squareFrom(file + df, rank + dir * dr);
      if (!sq) continue;
      const occ = namedUnitAt(chess, sq);
      if (occ?.type === "p" && occ.color === color) n += 1;
    }
  }
  return n;
}

function attackedSquareCount(chess: Chess, color: Color): number {
  let n = 0;
  for (const square of ALL_SQUARES) {
    if (chess.isAttacked(square, color)) n += 1;
  }
  return n;
}
