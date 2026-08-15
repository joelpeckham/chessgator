/** Target CSS pixels per dither cell. */
export const VEIL_CELL_PX = 4;
export const VEIL_GRID_MIN = 64;
export const VEIL_GRID_MAX = 512;

export const VEIL_COVERAGE_CENTER = 0.55;
export const VEIL_COVERAGE_EDGE = 0.1;
export const VEIL_RADIUS_INNER = 0.1;
export const VEIL_FALLOFF_GAMMA = 5;

/** Keep-probability for a cell. `falloffT` is 0 at center, 1 at the rim. */
export function veilCoverage(progress: number, falloffT: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const t = Math.min(1, Math.max(0, falloffT));
  const target =
    VEIL_COVERAGE_CENTER + (VEIL_COVERAGE_EDGE - VEIL_COVERAGE_CENTER) * t;
  return 1 + (target - 1) * p;
}

/** Dither cells across the board, snapped to chess-square boundaries. */
export function veilGridSize(boardCssPx: number): number {
  if (!Number.isFinite(boardCssPx) || boardCssPx <= 0) return VEIL_GRID_MIN;
  const cells = Math.round(boardCssPx / VEIL_CELL_PX);
  const snapped = Math.round(cells / 8) * 8;
  return Math.max(VEIL_GRID_MIN, Math.min(VEIL_GRID_MAX, snapped));
}
