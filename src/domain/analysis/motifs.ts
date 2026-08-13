import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import {
  allPieces,
  fileIndex,
  type NamedUnit,
  namedAttackers,
  oppositeColor,
  PIECE_VALUE_CP,
  rankIndex,
  rayDir,
  SLIDER_DIRS,
  squareFrom,
  walkRay,
} from "@/domain/analysis/board-units";
import { isHangingBySee, seeGainCp } from "@/domain/analysis/see";
import { findKingOnChess } from "@/domain/game";
import type { GameMove } from "@/domain/game/types";

export type PinFact = {
  pinner: NamedUnit;
  pinned: NamedUnit;
  target: NamedUnit;
  absolute: boolean;
};

export type SkewerFact = {
  skewer: NamedUnit;
  front: NamedUnit;
  back: NamedUnit;
};

export type ForkFact = {
  forker: NamedUnit;
  targets: NamedUnit[];
};

export type DiscoveredAttack = {
  mover: NamedUnit;
  revealed: NamedUnit;
  target: NamedUnit;
  isCheck: boolean;
};

export type OverloadFact = {
  defender: NamedUnit;
  targets: NamedUnit[];
};

export type RemovedDefenderFact = {
  defender: NamedUnit;
  newlyHanging: NamedUnit;
};

const FORK_TARGET_TYPES = new Set<PieceSymbol>(["n", "b", "r", "q", "k"]);

const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
];

export function detectPins(
  chess: Chess,
  defender: Color,
  opts: { relative?: boolean } = {},
): PinFact[] {
  const attacker = oppositeColor(defender);
  const kingSq = findKingOnChess(chess, defender);
  const pins: PinFact[] = [];

  for (const slider of allPieces(chess)) {
    if (slider.color !== attacker) continue;
    if (slider.type !== "b" && slider.type !== "r" && slider.type !== "q") {
      continue;
    }
    for (const dir of SLIDER_DIRS[slider.type]) {
      const hits = walkRay(chess, slider.square, dir, 2);
      if (hits.length < 2) continue;
      const [first, second] = hits;
      if (!first || !second) continue;
      if (first.color !== defender || second.color !== defender) continue;

      const absolute = second.type === "k" && second.square === kingSq;
      const relative =
        Boolean(opts.relative) &&
        !absolute &&
        PIECE_VALUE_CP[second.type] > PIECE_VALUE_CP[first.type] &&
        (second.type === "q" || second.type === "r");
      if (!absolute && !relative) continue;
      pins.push({
        pinner: slider,
        pinned: first,
        target: second,
        absolute,
      });
    }
  }
  return pins;
}

export function detectSkewers(chess: Chess, defender: Color): SkewerFact[] {
  const attacker = oppositeColor(defender);
  const skewers: SkewerFact[] = [];
  for (const slider of allPieces(chess)) {
    if (slider.color !== attacker) continue;
    if (slider.type !== "b" && slider.type !== "r" && slider.type !== "q") {
      continue;
    }
    for (const dir of SLIDER_DIRS[slider.type]) {
      const hits = walkRay(chess, slider.square, dir, 2);
      if (hits.length < 2) continue;
      const [front, back] = hits;
      if (!front || !back) continue;
      if (front.color !== defender || back.color !== defender) continue;
      if (PIECE_VALUE_CP[front.type] <= PIECE_VALUE_CP[back.type]) continue;
      if (front.type !== "k" && front.type !== "q" && front.type !== "r") {
        continue;
      }
      skewers.push({ skewer: slider, front, back });
    }
  }
  return skewers;
}

export function detectForks(chess: Chess, forker: NamedUnit): ForkFact[] {
  const opponent = oppositeColor(forker.color);
  const targets: NamedUnit[] = [];
  for (const unit of allPieces(chess)) {
    if (unit.color !== opponent) continue;
    if (!FORK_TARGET_TYPES.has(unit.type)) continue;
    if (!chess.attackers(unit.square, forker.color).includes(forker.square)) {
      continue;
    }
    targets.push(unit);
  }
  if (targets.length < 2) return [];
  const notable =
    forker.type === "n" ||
    targets.some((target) => target.type === "k" || target.type === "q");
  if (!notable) return [];
  return [{ forker, targets }];
}

export function detectDiscoveredAttacks(
  before: Chess,
  after: Chess,
  move: GameMove,
): DiscoveredAttack[] {
  const moverColor = move.color;
  const opponent = oppositeColor(moverColor);
  const moverAfter: NamedUnit = {
    type: move.piece,
    color: moverColor,
    square: move.to,
  };
  const found: DiscoveredAttack[] = [];

  for (const slider of allPieces(after)) {
    if (slider.color !== moverColor) continue;
    if (slider.type !== "b" && slider.type !== "r" && slider.type !== "q") {
      continue;
    }
    if (slider.square === move.to) continue;
    const dir = rayDir(slider.square, move.from);
    if (!dir) continue;
    if (!sliderTypeMatchesDir(slider.type, dir)) continue;

    const hitsAfter = walkRay(after, slider.square, dir, 2);
    const target = hitsAfter[0];
    if (!target || target.color !== opponent) continue;
    if (target.square === move.to) continue;

    const hitsBefore = walkRay(before, slider.square, dir, 2);
    const firstBefore = hitsBefore[0];
    if (firstBefore && firstBefore.square !== move.from) continue;

    found.push({
      mover: moverAfter,
      revealed: slider,
      target,
      isCheck: target.type === "k",
    });
  }
  return found;
}

export function detectTrappedPieces(chess: Chess, owner: Color): NamedUnit[] {
  const trapped: NamedUnit[] = [];
  for (const unit of allPieces(chess)) {
    if (unit.color !== owner) continue;
    if (unit.type === "k" || unit.type === "p") continue;
    if (!isHangingBySee(chess, unit.square, owner)) continue;
    if (!hasSafeFlight(chess, unit)) trapped.push(unit);
  }
  return trapped;
}

export function detectOverloadedDefenders(
  chess: Chess,
  owner: Color,
): OverloadFact[] {
  const defenderToTargets = new Map<string, NamedUnit[]>();
  for (const unit of allPieces(chess)) {
    if (unit.color !== owner || unit.type === "k") continue;
    const defenders = namedAttackers(chess, unit.square, owner);
    if (defenders.length !== 1) continue;
    const defender = defenders[0];
    if (!defender) continue;
    const needs =
      chess.isAttacked(unit.square, oppositeColor(owner)) &&
      PIECE_VALUE_CP[unit.type] >= 300;
    if (!needs) continue;
    const key = defender.square;
    const list = defenderToTargets.get(key) ?? [];
    list.push(unit);
    defenderToTargets.set(key, list);
  }
  const out: OverloadFact[] = [];
  for (const unit of allPieces(chess)) {
    const targets = defenderToTargets.get(unit.square);
    if (!targets || targets.length < 2) continue;
    out.push({ defender: unit, targets });
  }
  return out;
}

export function detectRemovedDefender(
  before: Chess,
  after: Chess,
  move: GameMove,
): RemovedDefenderFact | null {
  if (!move.captured) return null;
  const opponent = oppositeColor(move.color);
  const capturedSq = move.to;
  const newly = allPieces(after).find(
    (unit) =>
      unit.color === opponent &&
      unit.type !== "k" &&
      isHangingBySee(after, unit.square, opponent) &&
      !isHangingBySee(before, unit.square, opponent),
  );
  if (!newly) return null;
  const defendersBefore = namedAttackers(before, newly.square, opponent);
  const wasSole = defendersBefore.some((d) => d.square === capturedSq);
  if (!wasSole && defendersBefore.length !== 1) return null;
  return {
    defender: {
      type: move.captured,
      color: opponent,
      square: capturedSq,
    },
    newlyHanging: newly,
  };
}

export function detectBackRankVulnerability(
  chess: Chess,
  defender: Color,
): boolean {
  const kingSq = findKingOnChess(chess, defender);
  if (!kingSq) return false;
  const backRank = defender === "w" ? 1 : 8;
  if (rankIndex(kingSq) !== backRank) return false;

  const file = fileIndex(kingSq);
  let boxed = 0;
  for (const df of [-1, 0, 1]) {
    const pawnRank = defender === "w" ? 2 : 7;
    const sq = squareFrom(file + df, pawnRank);
    if (!sq) continue;
    const occ = chess.get(sq);
    if (occ?.type === "p" && occ.color === defender) boxed += 1;
  }
  if (boxed < 2) return false;

  const attacker = oppositeColor(defender);
  for (const unit of allPieces(chess)) {
    if (unit.color !== attacker) continue;
    if (unit.type !== "r" && unit.type !== "q") continue;
    if (canReachBackRank(chess, unit, backRank, kingSq)) return true;
  }
  return false;
}

function canReachBackRank(
  chess: Chess,
  unit: NamedUnit,
  backRank: number,
  kingSq: Square,
): boolean {
  if (rankIndex(unit.square) === backRank) {
    return chess.isAttacked(kingSq, unit.color);
  }
  const file = fileIndex(unit.square);
  const backSq = squareFrom(file, backRank);
  if (!backSq) return false;
  const dir = rayDir(unit.square, backSq);
  if (!dir) return false;
  const hits = walkRay(chess, unit.square, dir, 1);
  const first = hits[0];
  if (!first) return true;
  return rankIndex(first.square) === backRank;
}

export function detectPassedPawns(chess: Chess, color: Color): NamedUnit[] {
  const enemy = oppositeColor(color);
  const passed: NamedUnit[] = [];
  for (const unit of allPieces(chess)) {
    if (unit.color !== color || unit.type !== "p") continue;
    if (isPassedPawn(chess, unit, enemy)) passed.push(unit);
  }
  return passed;
}

function isPassedPawn(chess: Chess, pawn: NamedUnit, enemy: Color): boolean {
  const file = fileIndex(pawn.square);
  const rank = rankIndex(pawn.square);
  const dir = pawn.color === "w" ? 1 : -1;
  for (let r = rank + dir; r >= 1 && r <= 8; r += dir) {
    for (const df of [-1, 0, 1]) {
      const sq = squareFrom(file + df, r);
      if (!sq) continue;
      const occ = chess.get(sq);
      if (occ?.type === "p" && occ.color === enemy) return false;
    }
  }
  return true;
}

function sliderTypeMatchesDir(
  type: "b" | "r" | "q",
  dir: readonly [number, number],
): boolean {
  const diagonal = dir[0] !== 0 && dir[1] !== 0;
  if (type === "b") return diagonal;
  if (type === "r") return !diagonal;
  return true;
}

function geometricDestinations(chess: Chess, unit: NamedUnit): Square[] {
  const dest: Square[] = [];
  const file = fileIndex(unit.square);
  const rank = rankIndex(unit.square);
  if (unit.type === "n") {
    for (const [df, dr] of KNIGHT_DELTAS) {
      const sq = squareFrom(file + df, rank + dr);
      if (!sq) continue;
      const occ = chess.get(sq);
      if (!occ || occ.color !== unit.color) dest.push(sq);
    }
    return dest;
  }
  const dirs =
    unit.type === "b" || unit.type === "r" || unit.type === "q"
      ? SLIDER_DIRS[unit.type]
      : null;
  if (!dirs) return dest;
  for (const dir of dirs) {
    let f = file + dir[0];
    let r = rank + dir[1];
    while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
      const sq = squareFrom(f, r);
      if (!sq) break;
      const occ = chess.get(sq);
      if (!occ) dest.push(sq);
      else {
        if (occ.color !== unit.color) dest.push(sq);
        break;
      }
      f += dir[0];
      r += dir[1];
    }
  }
  return dest;
}

function hasSafeFlight(chess: Chess, unit: NamedUnit): boolean {
  const opponent = oppositeColor(unit.color);
  for (const dest of geometricDestinations(chess, unit)) {
    const occ = chess.get(dest);
    // Capturing a hanging piece of equal/higher value is an escape.
    if (occ && PIECE_VALUE_CP[occ.type] >= PIECE_VALUE_CP[unit.type]) {
      return true;
    }
    const clone = new Chess(chess.fen());
    clone.remove(unit.square);
    if (occ) clone.remove(dest);
    clone.put({ type: unit.type, color: unit.color }, dest);
    if (seeGainCp(clone, dest, opponent) <= 0) return true;
  }
  return false;
}
