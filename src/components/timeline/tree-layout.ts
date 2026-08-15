export const COL_W = 60;
export const LANE_H = 40;
/** Lanes visible in the collapsed strip. */
export const STRIP_LANE_COUNT = 3;
/** Short fork caption above the glyph ("Gator"). */
export const NODE_CAPTION_H = 12;
/** SAN under the glyph. */
export const NODE_LABEL_H = 14;
/** Keeps 44px hit targets and captions inside the svg box. */
export const GRAPH_PAD_TOP = 8;
export const STRIP_GRAPH_H =
  GRAPH_PAD_TOP + NODE_CAPTION_H + STRIP_LANE_COUNT * LANE_H + NODE_LABEL_H;
export const EXPANDED_GRAPH_H =
  GRAPH_PAD_TOP + NODE_CAPTION_H + 8 * LANE_H + NODE_LABEL_H;
export const STATUS_ROW_H = 24;
/** Collapsed strip: status row + three visible lanes. */
export const TIMELINE_GRAPH_HEIGHT_PX = STATUS_ROW_H + STRIP_GRAPH_H;
/** Tall mode: status row + eight visible lanes. */
export const TIMELINE_EXPANDED_HEIGHT_PX = STATUS_ROW_H + EXPANDED_GRAPH_H;

/** Mobile hit target (`size-11`); desktop buttons use `sm:size-9` (36px). */
export const NODE_HIT_PX = 44;
const LABEL_FROM_CENTER = 12;
const CAPTION_FROM_CENTER = 18;

export type LayoutInputNode = {
  id: string;
  parentId: string | null;
  ply: number;
  childIds: readonly string[];
};

export type NodePosition = {
  column: number;
  lane: number;
};

export type TreeLayout = {
  positions: ReadonlyMap<string, NodePosition>;
  minLane: number;
  maxLane: number;
  columns: number;
};

/**
 * Git-graph layout: column = ply. The oldest child stays on the parent
 * lane; later siblings fork into the emptier side. Lane 0 is the start
 * spine and is never stolen by a new branch.
 */
function nearestFreeOnSide(
  used: ReadonlySet<number>,
  parentLane: number,
  side: 1 | -1,
): number {
  let lane = parentLane + side;
  while (used.has(lane)) lane += side;
  return lane;
}

export function layoutTree(
  nodes: Readonly<Record<string, LayoutInputNode>>,
  rootId: string,
  bornAt?: ReadonlyMap<string, number>,
): TreeLayout {
  const positions = new Map<string, NodePosition>();

  function occupiedLanesAt(column: number): Set<number> {
    const used = new Set<number>();
    for (const pos of positions.values()) {
      if (pos.column === column) used.add(pos.lane);
    }
    return used;
  }

  function crowding(parentLane: number, column: number, side: 1 | -1): number {
    let count = 0;
    for (const pos of positions.values()) {
      if (pos.column < column) continue;
      if (Math.sign(pos.lane - parentLane) === side) count += 1;
    }
    return count;
  }

  function pickForkLane(parentLane: number, column: number): number {
    const used = occupiedLanesAt(column);
    used.add(parentLane);
    used.add(0);
    const up = nearestFreeOnSide(used, parentLane, 1);
    const down = nearestFreeOnSide(used, parentLane, -1);
    const upBusy = crowding(parentLane, column, 1);
    const downBusy = crowding(parentLane, column, -1);
    if (parentLane === 0) {
      if (downBusy < upBusy) return down;
      return up;
    }
    const towardZero: 1 | -1 = parentLane > 0 ? -1 : 1;
    const away: 1 | -1 = parentLane > 0 ? 1 : -1;
    const towardBusy = towardZero === 1 ? upBusy : downBusy;
    const awayBusy = away === 1 ? upBusy : downBusy;
    if (awayBusy < towardBusy) return away === 1 ? up : down;
    return towardZero === 1 ? up : down;
  }

  function childrenOf(node: LayoutInputNode): LayoutInputNode[] {
    const kids: LayoutInputNode[] = [];
    for (const childId of node.childIds) {
      const child = nodes[childId];
      if (child) kids.push(child);
    }
    if (bornAt) {
      kids.sort((a, b) => (bornAt.get(a.id) ?? 0) - (bornAt.get(b.id) ?? 0));
    }
    return kids;
  }

  function visit(node: LayoutInputNode): void {
    const kids = childrenOf(node);
    let continuationAssigned = false;
    for (const child of kids) {
      if (positions.has(child.id)) {
        continuationAssigned = true;
        visit(child);
        continue;
      }
      const parentLane = positions.get(node.id)?.lane ?? 0;
      const occupied = occupiedLanesAt(child.ply);
      const canContinue = !continuationAssigned && !occupied.has(parentLane);
      const lane = canContinue
        ? parentLane
        : pickForkLane(parentLane, child.ply);
      continuationAssigned = true;
      positions.set(child.id, { column: child.ply, lane });
      visit(child);
    }
  }

  const root = nodes[rootId];
  if (root) {
    positions.set(root.id, { column: root.ply, lane: 0 });
    visit(root);
  }

  let minLane = 0;
  let maxLane = 0;
  let maxColumn = 0;
  for (const pos of positions.values()) {
    if (pos.lane < minLane) minLane = pos.lane;
    if (pos.lane > maxLane) maxLane = pos.lane;
    if (pos.column > maxColumn) maxColumn = pos.column;
  }

  return {
    positions,
    minLane,
    maxLane,
    columns: maxColumn + 1,
  };
}

export function graphContentHeight(minLane: number, maxLane: number): number {
  const lanes = Math.max(1, maxLane - minLane + 1);
  return GRAPH_PAD_TOP + NODE_CAPTION_H + lanes * LANE_H + NODE_LABEL_H;
}

export function graphNodeCenter(
  column: number,
  lane: number,
  maxLane: number,
): { cx: number; cy: number } {
  const cy =
    GRAPH_PAD_TOP + NODE_CAPTION_H + (maxLane - lane) * LANE_H + LANE_H / 2;
  return {
    cx: column * COL_W + COL_W / 2,
    cy,
  };
}

export function graphLabelTop(cy: number): number {
  return cy + LABEL_FROM_CENTER;
}

export function graphCaptionTop(cy: number): number {
  return cy - CAPTION_FROM_CENTER;
}

function centerOffset(
  current: number,
  contentSize: number,
  viewportSize: number,
): number {
  if (contentSize <= viewportSize) return 0;
  const raw = viewportSize / 2 - current;
  const min = viewportSize - contentSize;
  return Math.min(0, Math.max(min, raw));
}

/**
 * Vertical translation that puts `currentCy` on the viewport midline.
 * Unclamped so a node on the top or bottom lane can still sit in the
 * center of a short strip or a tall expanded view.
 */
export function verticalCenterOffset(
  currentCy: number,
  viewportHeight: number,
): number {
  return viewportHeight / 2 - currentCy;
}

/** Horizontal translation that keeps `currentCx` in the middle of the viewport. */
export function horizontalCenterOffset(
  currentCx: number,
  contentWidth: number,
  viewportWidth: number,
): number {
  return centerOffset(currentCx, contentWidth, viewportWidth);
}

export function nearestFreeLane(
  used: ReadonlySet<number>,
  preferred: number,
): number {
  if (!used.has(preferred)) return preferred;
  for (let delta = 1; delta < 64; delta += 1) {
    if (!used.has(preferred + delta)) return preferred + delta;
    if (!used.has(preferred - delta)) return preferred - delta;
  }
  return preferred + 64;
}
