/** Maia Elo ladder shipped in the browser opponent. */
export const MAIA_ELO_MIN = 1100;
export const MAIA_ELO_MAX = 1900;
export const MAIA_ELO_STEP = 100;

export type GameColor = "white" | "black";

export type GamePreset = {
  elo?: number;
  color?: GameColor;
  fen?: string;
  /** SAN or UCI plies from the start position (or `fen`). */
  moves?: string[];
  /** 1-based ply to sit on after replaying `moves` (0 = start). */
  ply?: number;
};

export function clampMaiaElo(elo: number): number {
  const rounded = Math.round(elo / MAIA_ELO_STEP) * MAIA_ELO_STEP;
  return Math.min(MAIA_ELO_MAX, Math.max(MAIA_ELO_MIN, rounded));
}

function parseColor(value: string | null): GameColor | undefined {
  if (value === "white" || value === "w") return "white";
  if (value === "black" || value === "b") return "black";
  return undefined;
}

function parseMoves(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const moves = value
    .split(/[,\s]+/)
    .map((move) => move.trim())
    .filter((move) => move.length > 0 && !/^\d+\.+$/.test(move));
  return moves.length > 0 ? moves : undefined;
}

/** Build `/game?...` for content-page CTAs. */
export function gameHref(preset: GamePreset = {}): string {
  const params = new URLSearchParams();
  if (preset.elo !== undefined) {
    params.set("elo", String(clampMaiaElo(preset.elo)));
  }
  if (preset.color) params.set("color", preset.color);
  if (preset.fen) params.set("fen", preset.fen);
  if (preset.moves && preset.moves.length > 0) {
    params.set("moves", preset.moves.join(","));
  }
  if (preset.ply !== undefined) {
    params.set("ply", String(Math.max(0, Math.floor(preset.ply))));
  }
  const query = params.toString();
  return query ? `/game?${query}` : "/game";
}

/**
 * Parse `window.location.search` (or a `?…` string).
 * Returns null when no recognized preset keys are present.
 */
export function parseGameSearch(search: string): GamePreset | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  if (!query) return null;
  const params = new URLSearchParams(query);
  const preset: GamePreset = {};

  const eloRaw = params.get("elo");
  if (eloRaw) {
    const elo = Number(eloRaw);
    if (Number.isFinite(elo)) preset.elo = clampMaiaElo(elo);
  }

  const color = parseColor(params.get("color"));
  if (color) preset.color = color;

  const fen = params.get("fen")?.trim();
  if (fen) preset.fen = fen;

  const moves = parseMoves(params.get("moves"));
  if (moves) preset.moves = moves;

  const plyRaw = params.get("ply");
  if (plyRaw) {
    const ply = Number(plyRaw);
    if (Number.isInteger(ply) && ply >= 0) preset.ply = ply;
  }

  if (
    preset.elo === undefined &&
    !preset.color &&
    !preset.fen &&
    !preset.moves &&
    preset.ply === undefined
  ) {
    return null;
  }
  return preset;
}
