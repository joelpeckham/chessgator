export type BoardArrow = {
  from: string;
  to: string;
  color?: string;
};

/**
 * Keeps one arrow per route so react-chessboard never receives duplicate keys.
 * Later entries replace earlier ones, allowing later overlays to set the color.
 */
export function dedupeBoardArrows(arrows: BoardArrow[]): BoardArrow[] {
  const arrowsByRoute = new Map<string, BoardArrow>();

  for (const arrow of arrows) {
    arrowsByRoute.set(`${arrow.from}-${arrow.to}`, arrow);
  }

  return [...arrowsByRoute.values()];
}
