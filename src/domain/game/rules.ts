import {
  Chess,
  DEFAULT_POSITION,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
  validateFen,
} from "chess.js";
import type { GameMove, GameStatus, MoveInput } from "@/domain/game/types";

export { DEFAULT_POSITION, validateFen };
export type { Color, PieceSymbol, Square };

/** Create a fresh Chess instance for a FEN. Never persist this object. */
export function createChess(fen: string = DEFAULT_POSITION): Chess {
  return new Chess(fen);
}

export function getTurn(fen: string): Color {
  return createChess(fen).turn();
}

export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok;
}

/** Convert a chess.js Move into our normalized GameMove (UCI via LAN). */
export function toGameMove(move: Move): GameMove {
  const uci = moveToUci(move);
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    san: move.san,
    uci,
    color: move.color,
    piece: move.piece,
    captured: move.captured,
  };
}

export function moveToUci(move: Pick<Move, "from" | "to" | "promotion">): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function sanToUci(fen: string, san: string): string | null {
  const applied = tryApplyMove(fen, san);
  return applied?.move.uci ?? null;
}

export function uciToSan(fen: string, uci: string): string | null {
  const applied = tryApplyMove(fen, uci);
  return applied?.move.san ?? null;
}

export function parseUci(uci: string): {
  from: string;
  to: string;
  promotion?: PieceSymbol;
} | null {
  const trimmed = uci.trim();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(trimmed)) {
    return null;
  }
  const from = trimmed.slice(0, 2).toLowerCase();
  const to = trimmed.slice(2, 4).toLowerCase();
  const promotion = trimmed.slice(4, 5).toLowerCase() as PieceSymbol | "";
  return promotion
    ? { from, to, promotion: promotion as PieceSymbol }
    : { from, to };
}

function normalizeMoveInput(
  input: MoveInput,
): string | { from: string; to: string; promotion?: string } {
  if (typeof input === "string") {
    const asUci = parseUci(input);
    if (asUci) {
      return asUci;
    }
    return input;
  }
  return {
    from: String(input.from).toLowerCase(),
    to: String(input.to).toLowerCase(),
    ...(input.promotion ? { promotion: String(input.promotion).toLowerCase() } : {}),
  };
}

/** Legal moves from a FEN, as normalized GameMove values. */
export function getLegalMoves(fen: string, square?: Square | string): GameMove[] {
  const chess = createChess(fen);
  const moves = square
    ? chess.moves({ verbose: true, square: square as Square })
    : chess.moves({ verbose: true });
  return moves.map(toGameMove);
}

export function isLegalMove(fen: string, input: MoveInput): boolean {
  return tryApplyMove(fen, input) !== null;
}

/** Return the UCI move only when it is legal in `fen`; otherwise null. */
export function validateLegalUci(fen: string, uci: string | null | undefined): string | null {
  if (!uci) return null;
  const normalized = uci.trim().toLowerCase();
  if (!isLegalMove(fen, normalized)) return null;
  return normalized;
}

/** Walk a UCI line from fen, keeping only the legal prefix. */
export function legalUciPrefix(fen: string, pvUci: readonly string[]): string[] {
  const legal: string[] = [];
  let currentFen = fen;
  for (const raw of pvUci) {
    const applied = tryApplyMove(currentFen, raw.trim().toLowerCase());
    if (!applied) break;
    legal.push(applied.move.uci);
    currentFen = applied.fenAfter;
  }
  return legal;
}

export type AppliedMove = {
  move: GameMove;
  fenBefore: string;
  fenAfter: string;
  status: GameStatus;
};

/**
 * Apply a move without mutating caller state. Returns null if illegal.
 * chess.js is the sole rules authority.
 */
export function tryApplyMove(fen: string, input: MoveInput): AppliedMove | null {
  let chess: Chess;
  try {
    chess = createChess(fen);
  } catch {
    return null;
  }

  const fenBefore = chess.fen();
  let result: Move | null = null;
  try {
    result = chess.move(normalizeMoveInput(input));
  } catch {
    return null;
  }
  if (!result) {
    return null;
  }

  const fenAfter = chess.fen();
  return {
    move: toGameMove(result),
    fenBefore,
    fenAfter,
    status: getStatusFromChess(chess),
  };
}

export function getStatus(fen: string): GameStatus {
  return getStatusFromChess(createChess(fen));
}

function getStatusFromChess(chess: Chess): GameStatus {
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isThreefoldRepetition = chess.isThreefoldRepetition();
  const isInsufficientMaterial = chess.isInsufficientMaterial();
  const isDrawByFiftyMoves = chess.isDrawByFiftyMoves();
  const isDraw = chess.isDraw();
  const isGameOver = chess.isGameOver();
  const turn = chess.turn();

  let reason: GameStatus["reason"] = "ongoing";
  let result: GameStatus["result"] = "ongoing";

  if (isCheckmate) {
    reason = "checkmate";
    result = turn === "w" ? "blackWins" : "whiteWins";
  } else if (isStalemate) {
    reason = "stalemate";
    result = "draw";
  } else if (isThreefoldRepetition) {
    reason = "threefold";
    result = "draw";
  } else if (isDrawByFiftyMoves) {
    reason = "fiftyMove";
    result = "draw";
  } else if (isInsufficientMaterial) {
    reason = "insufficientMaterial";
    result = "draw";
  } else if (isDraw) {
    reason = "draw";
    result = "draw";
  }

  return {
    fen: chess.fen(),
    turn,
    isCheck: chess.isCheck(),
    isCheckmate,
    isStalemate,
    isDraw,
    isThreefoldRepetition,
    isInsufficientMaterial,
    isDrawByFiftyMoves,
    isGameOver,
    result,
    reason,
  };
}

/**
 * Reconstruct a Chess instance along a move path so repetition / fifty-move
 * state matches playing those moves from the root FEN.
 */
export function replayMoves(rootFen: string, moves: readonly GameMove[]): Chess {
  const chess = createChess(rootFen);
  for (const move of moves) {
    const result = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
    if (!result) {
      throw new Error(`Illegal move while replaying: ${move.uci}`);
    }
  }
  return chess;
}

export function getStatusAlongPath(
  rootFen: string,
  moves: readonly GameMove[],
): GameStatus {
  return getStatusFromChess(replayMoves(rootFen, moves));
}
