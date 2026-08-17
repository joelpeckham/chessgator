import { Chess, DEFAULT_POSITION, validateFen } from "chess.js";

/** Apply SAN or UCI plies and return the resulting FEN, or null if any ply is illegal. */
export function fenAfterMoves(
  moves: readonly string[],
  startFen: string = DEFAULT_POSITION,
): string | null {
  if (!validateFen(startFen).ok) return null;
  const chess = new Chess(startFen);
  for (const raw of moves) {
    const move = raw.trim();
    if (!move) continue;
    try {
      chess.move(move);
    } catch {
      return null;
    }
  }
  return chess.fen();
}

export function isValidFenString(fen: string): boolean {
  return validateFen(fen).ok;
}

export function fenSideToMove(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

export function isTerminalFen(fen: string): boolean {
  if (!isValidFenString(fen)) return true;
  return new Chess(fen).isGameOver();
}
