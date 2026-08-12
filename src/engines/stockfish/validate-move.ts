import { isLegalMove, tryApplyMove } from "@/domain/game/rules";

/** Return the UCI move only when it is legal in `fen`; otherwise null. */
export function validateLegalUci(fen: string, uci: string | null | undefined): string | null {
  if (!uci) return null;
  const normalized = uci.trim().toLowerCase();
  if (!isLegalMove(fen, normalized)) return null;
  return normalized;
}

/**
 * Walk a PV from `fen`, keeping only the legal prefix.
 * Stops at the first illegal or unparseable move.
 */
export function validatePvUci(fen: string, pvUci: readonly string[]): string[] {
  const legal: string[] = [];
  let currentFen = fen;
  for (const raw of pvUci) {
    const uci = raw.trim().toLowerCase();
    const applied = tryApplyMove(currentFen, uci);
    if (!applied) break;
    legal.push(applied.move.uci);
    currentFen = applied.fenAfter;
  }
  return legal;
}
