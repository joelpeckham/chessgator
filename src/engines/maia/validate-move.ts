import { isLegalMove } from "@/domain/game/rules";

/** Return the UCI move only when it is legal in `fen`; otherwise null. */
export function validateLegalUci(
  fen: string,
  uci: string | null | undefined,
): string | null {
  if (!uci) return null;
  const normalized = uci.trim().toLowerCase();
  if (!isLegalMove(fen, normalized)) return null;
  return normalized;
}
