import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { hangingSquaresFor, kingExposure } from "@/domain/analysis/tactics";
import { createChess, findKingOnChess } from "@/domain/game";
import { tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";

export type NamedUnit = {
  type: PieceSymbol;
  color: Color;
  square: Square;
};

export type CastleSide = "kingside" | "queenside";

export type PinFact = {
  pinner: NamedUnit;
  pinned: NamedUnit;
  target: NamedUnit;
};

export type ForkFact = {
  forker: NamedUnit;
  targets: NamedUnit[];
};

export type ThreatenedUnit = {
  piece: NamedUnit;
  attackers: NamedUnit[];
};

export type LineEvent = {
  ply: number;
  move: GameMove;
  captured: NamedUnit | null;
  gaveCheck: boolean;
  pins: PinFact[];
  forks: ForkFact[];
};

export type MoveEffects = {
  move: GameMove;
  castleSide: CastleSide | null;
  captured: NamedUnit | null;
  gaveCheck: boolean;
  developedPiece: boolean;
  kingSafer: boolean;
  kingMoreExposed: boolean;
  castlingRightsLost: boolean;
  retreatedToSafety: boolean;
  movedPieceHanging: ThreatenedUnit | null;
  newlyHanging: ThreatenedUnit[];
  ignoredThreats: ThreatenedUnit[];
  savedHanging: NamedUnit[];
  pinsCreated: PinFact[];
  forksCreated: ForkFact[];
  centerControlDelta: number;
};

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const CENTER_SQUARES: readonly Square[] = ["d4", "e4", "d5", "e5"];

const FORK_TARGET_TYPES = new Set<PieceSymbol>(["n", "b", "r", "q", "k"]);

const SLIDER_DIRS: Record<
  "b" | "r" | "q",
  ReadonlyArray<readonly [number, number]>
> = {
  b: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  r: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  q: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
};

function oppositeColor(color: Color): Color {
  return color === "w" ? "b" : "w";
}

export function castleSideOf(move: GameMove): CastleSide | null {
  if (move.piece !== "k") return null;
  const fromFile = move.from.charCodeAt(0);
  const toFile = move.to.charCodeAt(0);
  if (toFile - fromFile === 2) return "kingside";
  if (fromFile - toFile === 2) return "queenside";
  return null;
}

export function namedUnitAt(chess: Chess, square: Square): NamedUnit | null {
  const piece = chess.get(square);
  if (!piece) return null;
  return { type: piece.type, color: piece.color, square };
}

function allPieces(chess: Chess): NamedUnit[] {
  const out: NamedUnit[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      out.push({ type: cell.type, color: cell.color, square: cell.square });
    }
  }
  return out;
}

export function namedAttackers(
  chess: Chess,
  square: Square,
  by: Color,
): NamedUnit[] {
  const attackers: NamedUnit[] = [];
  for (const sq of chess.attackers(square, by)) {
    const unit = namedUnitAt(chess, sq);
    if (!unit || unit.color !== by) continue;
    attackers.push(unit);
  }
  return attackers.toSorted(
    (a, b) => PIECE_VALUE[b.type] - PIECE_VALUE[a.type],
  );
}

function capturedUnit(before: Chess, move: GameMove): NamedUnit | null {
  if (!move.captured) return null;
  const opponent = oppositeColor(move.color);
  if (
    move.piece === "p" &&
    move.from[0] !== move.to[0] &&
    !before.get(move.to)
  ) {
    const file = move.to[0] ?? "a";
    const rank = move.from[1] ?? "1";
    const square = `${file}${rank}` as Square;
    return { type: "p", color: opponent, square };
  }
  return { type: move.captured, color: opponent, square: move.to };
}

function centerControlScore(chess: Chess, color: Color): number {
  let score = 0;
  for (const square of CENTER_SQUARES) {
    const occ = chess.get(square);
    if (occ?.color === color) score += 2;
    if (chess.isAttacked(square, color)) score += 1;
  }
  return score;
}

export function detectPins(chess: Chess, defender: Color): PinFact[] {
  const attacker = oppositeColor(defender);
  const kingSq = findKingOnChess(chess, defender);
  if (!kingSq) return [];
  const king = namedUnitAt(chess, kingSq);
  if (!king) return [];

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
      if (
        first.color === defender &&
        second.type === "k" &&
        second.color === defender &&
        second.square === kingSq
      ) {
        pins.push({ pinner: slider, pinned: first, target: king });
      }
    }
  }
  return pins;
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

export function collectMoveEffects(input: {
  fenBefore: string;
  move: GameMove;
  fenAfter: string;
}): MoveEffects {
  const { fenBefore, move, fenAfter } = input;
  const before = createChess(fenBefore);
  const after = createChess(fenAfter);
  const mover = move.color;
  const opponent = oppositeColor(mover);

  const hangingBefore = hangingSquaresFor(before, mover) as Square[];
  const hangingAfter = hangingSquaresFor(after, mover) as Square[];
  const hangingBeforeSet = new Set(hangingBefore);
  const hangingAfterSet = new Set(hangingAfter);

  const captured = capturedUnit(before, move);
  const castleSide = castleSideOf(move);
  const exposureBefore = kingExposure(before, mover);
  const exposureAfter = kingExposure(after, mover);

  const movedPiece = namedUnitAt(after, move.to);
  const movedPieceHanging =
    hangingAfterSet.has(move.to) && movedPiece
      ? {
          piece: movedPiece,
          attackers: namedAttackers(after, move.to, opponent),
        }
      : null;

  const newlyHanging = hangingAfter
    .filter((sq) => sq !== move.to && !hangingBeforeSet.has(sq))
    .flatMap((sq) => threatenedAt(after, sq, opponent));

  const ignoredThreats = hangingBefore
    .filter((sq) => sq !== move.from && hangingAfterSet.has(sq))
    .flatMap((sq) => threatenedAt(after, sq, opponent));

  const savedHanging = hangingBefore
    .filter((sq) => sq !== move.from && !hangingAfterSet.has(sq))
    .flatMap((sq) => {
      const unit = namedUnitAt(after, sq) ?? namedUnitAt(before, sq);
      return unit ? [unit] : [];
    });

  const retreatedToSafety =
    hangingBeforeSet.has(move.from) && !hangingAfterSet.has(move.to);

  const opponentPinsBefore = detectPins(before, opponent);
  const opponentPinsAfter = detectPins(after, opponent);
  const pinsCreated = opponentPinsAfter.filter(
    (pin) =>
      pin.pinner.square === move.to &&
      !opponentPinsBefore.some(
        (old) =>
          old.pinned.square === pin.pinned.square &&
          old.pinner.square === pin.pinner.square,
      ),
  );

  const forker = movedPiece ?? {
    type: move.piece,
    color: mover,
    square: move.to,
  };
  const forksCreated = detectForks(after, forker);

  const developedPiece =
    move.piece !== "p" &&
    move.piece !== "k" &&
    move.from.endsWith(mover === "w" ? "1" : "8") &&
    !move.to.endsWith(mover === "w" ? "1" : "8");

  const rightsBefore = before.getCastlingRights(mover);
  const rightsAfter = after.getCastlingRights(mover);
  const castlingRightsLost =
    (rightsBefore.k || rightsBefore.q) && !rightsAfter.k && !rightsAfter.q;

  return {
    move,
    castleSide,
    captured,
    gaveCheck: after.isCheck(),
    developedPiece,
    kingSafer: exposureAfter < exposureBefore,
    kingMoreExposed: exposureAfter > exposureBefore,
    castlingRightsLost,
    retreatedToSafety,
    movedPieceHanging,
    newlyHanging,
    ignoredThreats,
    savedHanging,
    pinsCreated,
    forksCreated,
    centerControlDelta:
      centerControlScore(after, mover) - centerControlScore(before, mover),
  };
}

export function walkLineEvents(
  fen: string,
  pvUci: readonly string[],
  maxPlies = 4,
): LineEvent[] {
  const events: LineEvent[] = [];
  let cursor = fen;
  for (let ply = 0; ply < pvUci.length && ply < maxPlies; ply += 1) {
    const uci = pvUci[ply];
    if (!uci) break;
    const applied = tryApplyMove(cursor, uci);
    if (!applied) break;
    const before = createChess(cursor);
    const after = createChess(applied.fenAfter);
    const opponent = oppositeColor(applied.move.color);
    const pinsBefore = detectPins(before, opponent);
    const pinsAfter = detectPins(after, opponent);
    const forker: NamedUnit = {
      type: applied.move.piece,
      color: applied.move.color,
      square: applied.move.to,
    };
    events.push({
      ply,
      move: applied.move,
      captured: capturedUnit(before, applied.move),
      gaveCheck: after.isCheck(),
      pins: pinsAfter.filter(
        (pin) =>
          pin.pinner.square === applied.move.to &&
          !pinsBefore.some(
            (old) =>
              old.pinned.square === pin.pinned.square &&
              old.pinner.square === pin.pinner.square,
          ),
      ),
      forks: detectForks(after, forker),
    });
    cursor = applied.fenAfter;
  }
  return events;
}

function threatenedAt(
  chess: Chess,
  square: Square,
  attacker: Color,
): ThreatenedUnit[] {
  const piece = namedUnitAt(chess, square);
  if (!piece) return [];
  return [{ piece, attackers: namedAttackers(chess, square, attacker) }];
}

function walkRay(
  chess: Chess,
  from: Square,
  dir: readonly [number, number],
  maxHits: number,
): NamedUnit[] {
  const hits: NamedUnit[] = [];
  let file = from.charCodeAt(0) - 97 + dir[0];
  let rank = Number(from[1]) + dir[1];
  while (file >= 0 && file <= 7 && rank >= 1 && rank <= 8) {
    const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
    const unit = namedUnitAt(chess, square);
    if (unit) {
      hits.push(unit);
      if (hits.length >= maxHits) break;
    }
    file += dir[0];
    rank += dir[1];
  }
  return hits;
}
