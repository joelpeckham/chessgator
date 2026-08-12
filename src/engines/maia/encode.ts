/**
 * Upstream-compatible Maia3 board tokenization and move mirroring.
 * Port of CSSLab/maia3 `tokenize_board` / `mirror_move`.
 *
 * When Black is to move, python-chess `board.mirror()` is applied: vertical
 * flip + piece-color swap (side-to-move becomes White in the token space).
 */
import { Chess } from "chess.js";

/** Channel order: white P,N,B,R,Q,K then black p,n,b,r,q,k (0-based). */
const PIECE_CHANNEL: Record<string, number> = {
  P: 0,
  N: 1,
  B: 2,
  R: 3,
  Q: 4,
  K: 5,
  p: 6,
  n: 7,
  b: 8,
  r: 9,
  q: 10,
  k: 11,
};

const FILES = "abcdefgh";

export function squareToIndex(square: string): number {
  const file = FILES.indexOf(square[0]!);
  const rank = Number(square[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    throw new Error(`Invalid square: ${square}`);
  }
  return file + rank * 8;
}

export function indexToSquare(index: number): string {
  if (index < 0 || index > 63) throw new Error(`Invalid square index: ${index}`);
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return `${FILES[file]}${rank + 1}`;
}

/** Mirror a square vertically (rank ↔ 9-rank), matching upstream `mirror_square`. */
export function mirrorSquare(square: string): string {
  const file = square[0]!;
  const rank = 9 - Number(square[1]);
  return `${file}${rank}`;
}

/** Mirror a UCI move vertically; promotion piece is unchanged. */
export function mirrorMove(moveUci: string): string {
  const uci = moveUci.toLowerCase();
  const start = uci.slice(0, 2);
  const end = uci.slice(2, 4);
  const promo = uci.length > 4 ? uci.slice(4) : "";
  return mirrorSquare(start) + mirrorSquare(end) + promo;
}

type ColoredPiece = { type: string; color: "w" | "b" };

/**
 * Apply python-chess `BaseBoard.mirror()` piece placement:
 * vertical flip + color swap. Castling/ep are unused by piece-only tokens.
 */
function mirroredPieces(chess: Chess): Array<ColoredPiece | null> {
  const out: Array<ColoredPiece | null> = Array.from({ length: 64 }, () => null);
  const board = chess.board(); // [rank8..rank1][file a..h]

  for (let rankFromTop = 0; rankFromTop < 8; rankFromTop++) {
    const rank = 7 - rankFromTop; // 0 = rank 1
    for (let file = 0; file < 8; file++) {
      const piece = board[rankFromTop]![file];
      if (!piece) continue;
      const mirroredRank = 7 - rank;
      const mirroredIndex = file + mirroredRank * 8;
      out[mirroredIndex] = {
        type: piece.type,
        color: piece.color === "w" ? "b" : "w",
      };
    }
  }
  return out;
}

function piecesAsIs(chess: Chess): Array<ColoredPiece | null> {
  const out: Array<ColoredPiece | null> = Array.from({ length: 64 }, () => null);
  const board = chess.board();
  for (let rankFromTop = 0; rankFromTop < 8; rankFromTop++) {
    const rank = 7 - rankFromTop;
    for (let file = 0; file < 8; file++) {
      const piece = board[rankFromTop]![file];
      if (!piece) continue;
      out[file + rank * 8] = { type: piece.type, color: piece.color };
    }
  }
  return out;
}

/**
 * Tokenize a FEN into a Float32Array of length 64*12 (row-major square×channel).
 * When Black is to move the board is mirrored so the side-to-move is always White.
 */
export function tokenizeFen(fen: string): Float32Array {
  const chess = new Chess(fen);
  const tokens = new Float32Array(64 * 12);
  const pieces =
    chess.turn() === "b" ? mirroredPieces(chess) : piecesAsIs(chess);

  for (let square = 0; square < 64; square++) {
    const piece = pieces[square];
    if (!piece) continue;
    const channelKey =
      piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase();
    const channel = PIECE_CHANNEL[channelKey];
    if (channel === undefined) continue;
    tokens[square * 12 + channel] = 1;
  }

  return tokens;
}

/**
 * Encode tokens for the browser ONNX export: shape [1, 64, 12].
 * Optional `historyFens` is accepted for API forward-compat but ignored —
 * the published export repeats the current board internally.
 */
export function encodeTokensForBrowserExport(
  fen: string,
  _historyFens?: readonly string[],
): { tokens: Float32Array; dims: [number, number, number] } {
  void _historyFens;
  const tokens = tokenizeFen(fen);
  return { tokens, dims: [1, 64, 12] };
}

export function eloTensors(
  selfElo: number,
  oppoElo: number,
): { eloSelf: Float32Array; eloOppo: Float32Array } {
  return {
    eloSelf: Float32Array.of(selfElo),
    eloOppo: Float32Array.of(oppoElo),
  };
}

/** Map a real-board UCI move into vocabulary UCI (mirror when Black to move). */
export function toVocabUci(fen: string, moveUci: string): string {
  const turn = fen.split(" ")[1];
  const uci = moveUci.toLowerCase();
  return turn === "b" ? mirrorMove(uci) : uci;
}

/** Map a vocabulary UCI prediction back to the real board (unmirror when Black). */
export function fromVocabUci(fen: string, vocabUci: string): string {
  const turn = fen.split(" ")[1];
  const uci = vocabUci.toLowerCase();
  return turn === "b" ? mirrorMove(uci) : uci;
}
