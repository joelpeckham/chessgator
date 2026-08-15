/** Target CSS pixels per dither cell. */
export const VEIL_CELL_PX = 4;
export const VEIL_GRID_MIN = 64;
export const VEIL_GRID_MAX = 512;

export const VEIL_COVERAGE_CENTER = 0.55;
export const VEIL_COVERAGE_EDGE = 0.1;
export const VEIL_RADIUS_INNER = 0.1;
export const VEIL_FALLOFF_GAMMA = 5;

/** Dither cells across the board, snapped to chess-square boundaries. */
export function veilGridSize(boardCssPx: number): number {
  if (!Number.isFinite(boardCssPx) || boardCssPx <= 0) return VEIL_GRID_MIN;
  const cells = Math.round(boardCssPx / VEIL_CELL_PX);
  const snapped = Math.round(cells / 8) * 8;
  return Math.max(VEIL_GRID_MIN, Math.min(VEIL_GRID_MAX, snapped));
}
