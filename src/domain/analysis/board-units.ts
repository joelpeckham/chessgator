import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export type NamedUnit = {
  type: PieceSymbol;
  color: Color;
  square: Square;
};

export const PIECE_VALUE_CP: Record<PieceSymbol, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 10_000,
};

export const SLIDER_DIRS: Record<
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

export const ALL_SQUARES: readonly Square[] = (() => {
  const squares: Square[] = [];
  for (let file = 0; file < 8; file += 1) {
    for (let rank = 1; rank <= 8; rank += 1) {
      squares.push(`${String.fromCharCode(97 + file)}${rank}` as Square);
    }
  }
  return squares;
})();

export function oppositeColor(color: Color): Color {
  return color === "w" ? "b" : "w";
}

export function namedUnitAt(chess: Chess, square: Square): NamedUnit | null {
  const piece = chess.get(square);
  if (!piece) return null;
  return { type: piece.type, color: piece.color, square };
}

export function allPieces(chess: Chess): NamedUnit[] {
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
    (a, b) => PIECE_VALUE_CP[b.type] - PIECE_VALUE_CP[a.type],
  );
}

export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - 97;
}

export function rankIndex(square: Square): number {
  return Number(square[1]);
}

export function squareFrom(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${String.fromCharCode(97 + file)}${rank}` as Square;
}

export function walkRay(
  chess: Chess,
  from: Square,
  dir: readonly [number, number],
  maxHits: number,
): NamedUnit[] {
  const hits: NamedUnit[] = [];
  let file = fileIndex(from) + dir[0];
  let rank = rankIndex(from) + dir[1];
  while (file >= 0 && file <= 7 && rank >= 1 && rank <= 8) {
    const square = squareFrom(file, rank);
    if (!square) break;
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

export function rayDir(
  from: Square,
  through: Square,
): readonly [number, number] | null {
  const df = fileIndex(through) - fileIndex(from);
  const dr = rankIndex(through) - rankIndex(from);
  if (df === 0 && dr === 0) return null;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  if (df !== 0 && dr !== 0 && adf !== adr) return null;
  const stepF = df === 0 ? 0 : df / adf;
  const stepR = dr === 0 ? 0 : dr / adr;
  return [stepF, stepR];
}

export function materialLabel(cp: number): string {
  const abs = Math.abs(cp);
  if (abs >= 800) return "a queen";
  if (abs >= 400) return "a rook";
  if (abs >= 250) return "a knight";
  if (abs >= 200) return "a bishop";
  if (abs >= 80) return "a pawn";
  return "material";
}
