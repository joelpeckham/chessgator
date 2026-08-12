/**
 * Maia3 move vocabulary (4352 entries), matching CSSLab/maia3 `get_all_possible_moves`.
 *
 * Layout:
 * - indices 0..4095: every from→to square pair in chess.js square order
 *   (file-major within rank; square = file + rank * 8)
 * - indices 4096..4351: white-perspective promotions `*[7][a-h]8[qrbn]`
 *   (board is mirrored when Black to move, so promotions are always rank 7→8)
 */

export const MOVE_VOCAB_SIZE = 4352;
export const BASE_MOVE_COUNT = 64 * 64; // 4096
export const PROMOTION_COUNT = 8 * 8 * 4; // 256
export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;

export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

const FILES = "abcdefgh";

let cachedMoves: string[] | null = null;
let cachedIndex: Map<string, number> | null = null;

function squareName(file: number, rank: number): string {
  return `${FILES[file]}${rank + 1}`;
}

/** Build the full 4352-entry vocabulary (cached). */
export function getAllPossibleMoves(): readonly string[] {
  if (cachedMoves) return cachedMoves;

  const moves: string[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const from = squareName(file, rank);
      for (let targetRank = 0; targetRank < 8; targetRank++) {
        for (let targetFile = 0; targetFile < 8; targetFile++) {
          moves.push(from + squareName(targetFile, targetRank));
        }
      }
    }
  }

  for (const fileFrom of FILES) {
    for (const fileTo of FILES) {
      for (const piece of PROMOTION_PIECES) {
        moves.push(`${fileFrom}7${fileTo}8${piece}`);
      }
    }
  }

  if (moves.length !== MOVE_VOCAB_SIZE) {
    throw new Error(`Expected ${MOVE_VOCAB_SIZE} moves, got ${moves.length}`);
  }

  cachedMoves = moves;
  return moves;
}

export function getMoveIndexMap(): ReadonlyMap<string, number> {
  if (cachedIndex) return cachedIndex;
  const map = new Map<string, number>();
  getAllPossibleMoves().forEach((uci, i) => map.set(uci, i));
  cachedIndex = map;
  return map;
}

export function moveToIndex(uci: string): number | undefined {
  return getMoveIndexMap().get(uci.toLowerCase());
}

export function indexToMove(index: number): string | undefined {
  if (index < 0 || index >= MOVE_VOCAB_SIZE) return undefined;
  return getAllPossibleMoves()[index];
}

/** Index of a quiet (non-promotion) from→to pair. */
export function quietMoveIndex(fromSquare: number, toSquare: number): number {
  return fromSquare * 64 + toSquare;
}

/**
 * Index of a white-perspective promotion `fileFrom7fileTo8piece`.
 * `fileFrom` / `fileTo` are 0..7 (a..h); `piece` is q|r|b|n.
 */
export function promotionMoveIndex(
  fileFrom: number,
  fileTo: number,
  piece: PromotionPiece,
): number {
  const pieceIdx = PROMOTION_PIECES.indexOf(piece);
  if (
    fileFrom < 0 ||
    fileFrom > 7 ||
    fileTo < 0 ||
    fileTo > 7 ||
    pieceIdx < 0
  ) {
    throw new Error(`Invalid promotion: ${fileFrom}${fileTo}${piece}`);
  }
  return BASE_MOVE_COUNT + (fileFrom * 8 + fileTo) * 4 + pieceIdx;
}
