import { Chess } from "chess.js";

export type ParsedPgnMove = {
  san: string;
  uci: string;
  fenAfter: string;
};

export type ParsedPgn = {
  headers: Record<string, string>;
  moves: ParsedPgnMove[];
};

function moveUci(move: {
  lan: string;
  from: string;
  to: string;
  promotion?: string;
}): string {
  if (move.lan) return move.lan.toLowerCase();
  return `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();
}

/**
 * Parse a single-game PGN into headers and a mainline of SAN/UCI/FEN plies.
 * Returns null when the text is empty or chess.js cannot load it.
 */
export function parsePgn(pgn: string): ParsedPgn | null {
  const text = pgn.trim();
  if (!text) return null;

  const chess = new Chess();
  try {
    chess.loadPgn(text);
  } catch {
    return null;
  }

  const headers = { ...chess.getHeaders() };
  const history = chess.history({ verbose: true });
  const moves = history.map((move) => ({
    san: move.san,
    uci: moveUci(move),
    fenAfter: move.after,
  }));

  if (moves.length === 0 && Object.keys(headers).length === 0) return null;
  return { headers, moves };
}
