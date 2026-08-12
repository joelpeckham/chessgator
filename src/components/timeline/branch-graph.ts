import type { ProjectedLine } from "@/domain/analysis/projected-lines";
import {
  getAncestors,
  getNode,
  listMainlineChild,
  type GameNode,
  type GameTree,
} from "@/domain/game";

export type TimelineNodeKind =
  | "committed"
  | "variation"
  | "projected"
  | "tutor";

export type TimelineLaneRole =
  | "played"
  | "coach"
  | "engine"
  | "variationA"
  | "variationB"
  | "overflow";

export type TimelineGraphNode = {
  id: string;
  parentId: string | null;
  fen: string;
  san: string | null;
  /** Numbered SAN label, e.g. "1.e4", "8…d5", or "start". */
  moveLabel: string;
  ply: number;
  kind: TimelineNodeKind;
  laneRole: TimelineLaneRole;
  /** Stable branch identity: `played:…`, `var:parent:uci`, `tutor:…`, `projected:…`. */
  branchKey: string;
  /** 0 = current game; +1 coach; −1 engine; ±2 variations. */
  lane: number;
  column: number;
  /** Matches the live game playhead (`tree.currentNodeId`). */
  isLive: boolean;
  /** Matches the ephemeral review cursor. */
  isReview: boolean;
  isOnPlayedPath: boolean;
  isOnReviewPath: boolean;
  /**
   * For projected/tutor nodes: the committed tree node the line branches from.
   * For committed/variation: the tree node id (same as `id`).
   */
  sourceNodeId: string;
  uciFromParent: string | null;
  /** True when this node is a collapsed "+N" overflow sentinel. */
  isOverflow?: boolean;
  overflowCount?: number;
  overflowGroupId?: string;
  /** True when a side branch hit the forward ply cap. */
  isTruncated?: boolean;
};

export type TimelineGraphEdge = {
  fromId: string;
  toId: string;
  kind: TimelineNodeKind;
};

export type TimelineOverflowBranch = {
  branchKey: string;
  headNodeId: string;
  san: string;
  uci: string;
  moveLabel: string;
  fen: string;
  ply: number;
  length: number;
};

export type TimelineOverflowGroup = {
  id: string;
  parentId: string;
  column: number;
  hiddenBranches: TimelineOverflowBranch[];
};

export type TimelineGraph = {
  nodes: TimelineGraphNode[];
  edges: TimelineGraphEdge[];
  /** Max absolute lane used (for vertical sizing). */
  maxLaneAbs: number;
  columns: number;
  currentGamePath: readonly string[];
  reviewPath: readonly string[];
  liveTipColumn: number;
  overflowGroups: TimelineOverflowGroup[];
};

export type BuildBranchGraphInput = {
  tree: GameTree;
  /** Ephemeral review cursor; null follows the live playhead. */
  reviewNodeId?: string | null;
  /** Best-play future from the live tip. */
  futureLine?: ProjectedLine | null;
  /** Coach alternate line (e.g. improvement from before the last move). */
  tutorLine?: ProjectedLine | null;
  /**
   * Branch keys the user has pinned from overflow menus.
   * Format: `var:${parentId}:${uci}`.
   */
  expandedOverflowKeys?: readonly string[];
  /**
   * Max absolute side lane for variations.
   * Desktop: 2 (±2 variation slots). Mobile: 1 (no variation slots; overflow sooner).
   */
  maxLaneSide?: number;
  /**
   * When false, suppress the engine future line (e.g. during review or when
   * coach context should take the secondary slot on mobile).
   */
  showEngineLine?: boolean;
  /**
   * When false, suppress the coach projected line.
   */
  showCoachLine?: boolean;
};

export const LANE = {
  played: 0,
  coach: 1,
  engine: -1,
  variationA: 2,
  variationB: -2,
} as const;

const MAX_LANE_SIDE_DEFAULT = 2;
const BRANCH_FORWARD_PLIES = 8;

function formatMoveLabel(ply: number, san: string | null): string {
  if (!san) return "start";
  const moveNumber = Math.floor((ply + 1) / 2);
  if (ply % 2 === 1) return `${moveNumber}.${san}`;
  return `${moveNumber}…${san}`;
}

function plyLabelSan(node: GameNode): string | null {
  return node.move?.san ?? null;
}

function virtualId(
  kind: "projected" | "tutor",
  rootId: string,
  pathKey: string,
): string {
  return `${kind}:${rootId}:${pathKey}`;
}

function variationBranchKey(parentId: string, uci: string): string {
  return `var:${parentId}:${uci}`;
}

function countBranchLength(tree: GameTree, head: GameNode): number {
  let length = 0;
  let current: GameNode | null = head;
  const seen = new Set<string>();
  while (current && !seen.has(current.id) && length < BRANCH_FORWARD_PLIES) {
    seen.add(current.id);
    length += 1;
    const nextId = current.childIds[0];
    if (!nextId) break;
    current = getNode(tree, nextId);
  }
  return length;
}

/**
 * Build a horizontal branch graph with semantic lanes:
 * - lane 0: current (played) game path
 * - lane +1: coach projected line
 * - lane −1: engine future line
 * - lanes ±2: saved variations (overflow when slots are full)
 *
 * Lane assignment is independent of the review cursor. Review only affects
 * `isReview` / `isOnReviewPath` / `reviewPath`.
 */
export function buildBranchGraph(input: BuildBranchGraphInput): TimelineGraph {
  const {
    tree,
    futureLine = null,
    tutorLine = null,
    expandedOverflowKeys = [],
    maxLaneSide = MAX_LANE_SIDE_DEFAULT,
    showEngineLine = true,
    showCoachLine = true,
  } = input;
  const liveId = tree.currentNodeId;
  const reviewId = input.reviewNodeId ?? liveId;
  const expanded = new Set(expandedOverflowKeys);

  const nodesById = new Map<string, TimelineGraphNode>();
  const edges: TimelineGraphEdge[] = [];
  const overflowGroups: TimelineOverflowGroup[] = [];

  // --- Phase 1: current game path on lane 0 ---
  const liveAncestors = getAncestors(tree, liveId);
  const mainPath: GameNode[] = [...liveAncestors];
  let cursor = listMainlineChild(tree, liveId);
  while (cursor) {
    mainPath.push(cursor);
    cursor = listMainlineChild(tree, cursor.id);
  }

  const mainPathIds = new Set(mainPath.map((n) => n.id));
  const columnById = new Map<string, number>();
  const usedLanesAtColumn = new Map<number, Set<number>>();

  function lanesAt(column: number): Set<number> {
    let used = usedLanesAtColumn.get(column);
    if (!used) {
      used = new Set();
      usedLanesAtColumn.set(column, used);
    }
    return used;
  }

  function markLaneUsed(column: number, lane: number): void {
    lanesAt(column).add(lane);
  }

  function isLaneFree(column: number, lane: number): boolean {
    return !lanesAt(column).has(lane);
  }

  /** Reserve a fixed lane across [startCol, endCol] inclusive. */
  function canReserveInterval(
    startCol: number,
    endCol: number,
    lane: number,
  ): boolean {
    for (let col = startCol; col <= endCol; col += 1) {
      if (!isLaneFree(col, lane)) return false;
    }
    return true;
  }

  function reserveInterval(
    startCol: number,
    endCol: number,
    lane: number,
  ): void {
    for (let col = startCol; col <= endCol; col += 1) {
      markLaneUsed(col, lane);
    }
  }

  mainPath.forEach((node, column) => {
    columnById.set(node.id, column);
    const kind: TimelineNodeKind = node.isVariation ? "variation" : "committed";
    const san = plyLabelSan(node);
    nodesById.set(node.id, {
      id: node.id,
      parentId: node.parentId,
      fen: node.fen,
      san,
      moveLabel: formatMoveLabel(node.ply, san),
      ply: node.ply,
      kind,
      laneRole: "played",
      branchKey: `played:${node.id}`,
      lane: LANE.played,
      column,
      isLive: node.id === liveId,
      isReview: node.id === reviewId,
      isOnPlayedPath: true,
      isOnReviewPath: false,
      sourceNodeId: node.id,
      uciFromParent: node.move?.uci ?? null,
    });
    markLaneUsed(column, LANE.played);
    if (node.parentId) {
      edges.push({ fromId: node.parentId, toId: node.id, kind });
    }
  });

  const currentGamePath = mainPath.map((n) => n.id);
  const liveTipColumn = columnById.get(liveId) ?? 0;

  // --- Phase 2: variation branches ---
  type PendingBranch = {
    node: GameNode;
    parentId: string;
    branchKey: string;
    lane: number;
    laneRole: TimelineLaneRole;
  };
  const pending: PendingBranch[] = [];

  const variationSlots =
    maxLaneSide >= 2
      ? [
          { lane: LANE.variationA, role: "variationA" as const },
          { lane: LANE.variationB, role: "variationB" as const },
        ]
      : maxLaneSide >= 1
        ? [{ lane: LANE.variationA, role: "variationA" as const }]
        : [];

  for (const parent of mainPath) {
    const parentCol = columnById.get(parent.id)!;
    const mainChild = listMainlineChild(tree, parent.id);
    const siblings = parent.childIds
      .map((id) => tree.nodes[id])
      .filter((child): child is GameNode => {
        if (!child) return false;
        if (mainChild && child.id === mainChild.id) return false;
        if (mainPathIds.has(child.id)) return false;
        return true;
      })
      .sort((a, b) => {
        const uciA = a.move?.uci ?? a.id;
        const uciB = b.move?.uci ?? b.id;
        return uciA.localeCompare(uciB) || a.id.localeCompare(b.id);
      });

    if (siblings.length === 0) continue;

    const pinned: GameNode[] = [];
    const unpinned: GameNode[] = [];
    for (const sibling of siblings) {
      const key = variationBranchKey(parent.id, sibling.move?.uci ?? sibling.id);
      if (expanded.has(key)) pinned.push(sibling);
      else unpinned.push(sibling);
    }

    // Prefer pinned branches, then fill remaining slots by UCI order.
    const preferred = [...pinned, ...unpinned];
    const visible: GameNode[] = [];
    const hidden: GameNode[] = [];

    for (const sibling of preferred) {
      if (visible.length < variationSlots.length) {
        visible.push(sibling);
      } else {
        hidden.push(sibling);
      }
    }

    visible.forEach((sibling, index) => {
      const slot = variationSlots[index]!;
      const key = variationBranchKey(
        parent.id,
        sibling.move?.uci ?? sibling.id,
      );
      // Pre-check first ply availability; sticky lane for rest.
      if (!isLaneFree(parentCol + 1, slot.lane)) {
        hidden.push(sibling);
        return;
      }
      pending.push({
        node: sibling,
        parentId: parent.id,
        branchKey: key,
        lane: slot.lane,
        laneRole: slot.role,
      });
    });

    if (hidden.length > 0) {
      const overflowId = `overflow:${parent.id}`;
      const overflowCol = parentCol + 1;
      // Place overflow hub on the last variation slot if free, else coach lane
      // temporarily (never lane 0).
      let hubLane: number =
        variationSlots[variationSlots.length - 1]?.lane ?? LANE.coach;
      if (!isLaneFree(overflowCol, hubLane)) {
        const alt: number | null =
          variationSlots.find((s) => isLaneFree(overflowCol, s.lane))?.lane ??
          (isLaneFree(overflowCol, LANE.coach) ? LANE.coach : null);
        if (alt == null) {
          // Extremely crowded column — still expose metadata without a hub node.
          overflowGroups.push({
            id: overflowId,
            parentId: parent.id,
            column: overflowCol,
            hiddenBranches: hidden.map((h) => ({
              branchKey: variationBranchKey(parent.id, h.move?.uci ?? h.id),
              headNodeId: h.id,
              san: h.move?.san ?? "?",
              uci: h.move?.uci ?? "",
              moveLabel: formatMoveLabel(h.ply, h.move?.san ?? null),
              fen: h.fen,
              ply: h.ply,
              length: countBranchLength(tree, h),
            })),
          });
          continue;
        }
        hubLane = alt;
      }
      markLaneUsed(overflowCol, hubLane);
      nodesById.set(overflowId, {
        id: overflowId,
        parentId: parent.id,
        fen: parent.fen,
        san: `+${hidden.length}`,
        moveLabel: `+${hidden.length}`,
        ply: parent.ply + 1,
        kind: "variation",
        laneRole: "overflow",
        branchKey: `overflow:${parent.id}`,
        lane: hubLane,
        column: overflowCol,
        isLive: false,
        isReview: false,
        isOnPlayedPath: false,
        isOnReviewPath: false,
        sourceNodeId: parent.id,
        uciFromParent: null,
        isOverflow: true,
        overflowCount: hidden.length,
        overflowGroupId: overflowId,
      });
      edges.push({ fromId: parent.id, toId: overflowId, kind: "variation" });
      overflowGroups.push({
        id: overflowId,
        parentId: parent.id,
        column: overflowCol,
        hiddenBranches: hidden.map((h) => ({
          branchKey: variationBranchKey(parent.id, h.move?.uci ?? h.id),
          headNodeId: h.id,
          san: h.move?.san ?? "?",
          uci: h.move?.uci ?? "",
          moveLabel: formatMoveLabel(h.ply, h.move?.san ?? null),
          fen: h.fen,
          ply: h.ply,
          length: countBranchLength(tree, h),
        })),
      });
    }
  }

  // Place each visible variation on a sticky lane.
  for (const branch of pending) {
    const parentCol = columnById.get(branch.parentId) ?? 0;
    let current: GameNode | null = branch.node;
    let parentId = branch.parentId;
    let col = parentCol + 1;
    let truncated = false;

    // Reserve the full interval first (up to cap) so lane stays sticky.
    const segmentNodes: GameNode[] = [];
    {
      let walk: GameNode | null = current;
      const seen = new Set<string>();
      for (let depth = 0; walk && depth < BRANCH_FORWARD_PLIES; depth += 1) {
        if (seen.has(walk.id) || nodesById.has(walk.id)) break;
        seen.add(walk.id);
        segmentNodes.push(walk);
        const nextId = walk.childIds[0];
        if (!nextId) break;
        const next = getNode(tree, nextId);
        if (!next || mainPathIds.has(next.id)) break;
        if (next.childIds.length === 0 && depth + 1 >= BRANCH_FORWARD_PLIES - 1) {
          // Will truncate after this next if deeper exists — checked below.
        }
        walk = next;
        if (depth === BRANCH_FORWARD_PLIES - 1) {
          // Cap reached; if there would be more, mark truncated later.
          const deeper = walk.childIds[0]
            ? getNode(tree, walk.childIds[0])
            : null;
          if (deeper && !mainPathIds.has(deeper.id)) truncated = true;
        }
      }
    }

    const startCol = col;
    const endCol = startCol + segmentNodes.length - 1;
    if (
      segmentNodes.length === 0 ||
      !canReserveInterval(startCol, endCol, branch.lane)
    ) {
      continue;
    }
    reserveInterval(startCol, endCol, branch.lane);

    for (let i = 0; i < segmentNodes.length; i += 1) {
      current = segmentNodes[i]!;
      const kind: TimelineNodeKind = current.isVariation
        ? "variation"
        : "committed";
      const san = plyLabelSan(current);
      columnById.set(current.id, col);
      nodesById.set(current.id, {
        id: current.id,
        parentId,
        fen: current.fen,
        san,
        moveLabel: formatMoveLabel(current.ply, san),
        ply: current.ply,
        kind,
        laneRole: branch.laneRole,
        branchKey: branch.branchKey,
        lane: branch.lane,
        column: col,
        isLive: current.id === liveId,
        isReview: current.id === reviewId,
        isOnPlayedPath: false,
        isOnReviewPath: false,
        sourceNodeId: current.id,
        uciFromParent: current.move?.uci ?? null,
        isTruncated: truncated && i === segmentNodes.length - 1,
      });
      edges.push({ fromId: parentId, toId: current.id, kind });
      parentId = current.id;
      col += 1;
    }
  }

  // --- Phase 3: projected lines with gating ---
  function isAncestorOf(
    ancestorId: string,
    descendantId: string,
  ): boolean {
    if (ancestorId === descendantId) return true;
    const ancestors = getAncestors(tree, descendantId);
    return ancestors.some((n) => n.id === ancestorId);
  }

  function shouldShowFuture(line: ProjectedLine): boolean {
    if (!showEngineLine) return false;
    // Only at the live tip while reviewing live — never while scrubbing history.
    if (reviewId !== liveId) return false;
    // Player-facing only: never draw an engine line that starts on Black's turn
    // (that reads as "hints for the opponent").
    const side = line.rootFen.split(" ")[1];
    if (side !== "w") return false;
    // Must be rooted at the live tip so a stale pre-move projection cannot linger.
    return line.rootNodeId === liveId;
  }

  function shouldShowTutor(line: ProjectedLine): boolean {
    if (!showCoachLine) return false;
    if (reviewId === line.rootNodeId) return true;
    if (isVirtualTimelineId(reviewId)) {
      const parsed = parseVirtualTimelineId(reviewId);
      return parsed?.kind === "tutor" && parsed.rootNodeId === line.rootNodeId;
    }
    // Show when reviewing the live tip after a coached move, or on the
    // played path at/after the coach root.
    if (reviewId === liveId) return true;
    return isAncestorOf(line.rootNodeId, reviewId);
  }

  function attachProjectedLine(
    line: ProjectedLine,
    kind: "projected" | "tutor",
  ): void {
    const root = nodesById.get(line.rootNodeId);
    if (!root) return;

    const lane = kind === "projected" ? LANE.engine : LANE.coach;
    const laneRole: TimelineLaneRole =
      kind === "projected" ? "engine" : "coach";
    const branchKey =
      kind === "projected"
        ? `projected:${line.rootNodeId}`
        : `tutor:${line.rootNodeId}`;

    let parentId = line.rootNodeId;
    let parentCol = root.column;

    for (const ply of line.plies) {
      const id = virtualId(kind, line.rootNodeId, ply.pathKey);

      // Reuse committed/variation child if already placed.
      const parentNode = getNode(tree, parentId);
      const existingChild = parentNode?.childIds
        .map((cid) => tree.nodes[cid])
        .find((c) => c?.move?.uci === ply.uci);
      if (existingChild && nodesById.has(existingChild.id)) {
        const existing = nodesById.get(existingChild.id)!;
        parentId = existingChild.id;
        parentCol = existing.column;
        continue;
      }
      if (existingChild && !nodesById.has(existingChild.id)) {
        parentId = existingChild.id;
        parentCol += 1;
        continue;
      }

      const column = parentCol + 1;
      // Engine futures only extend past the live tip.
      if (kind === "projected" && column <= liveTipColumn) {
        break;
      }
      if (!isLaneFree(column, lane)) break;
      markLaneUsed(column, lane);

      nodesById.set(id, {
        id,
        parentId,
        fen: ply.fen,
        san: ply.san,
        moveLabel: formatMoveLabel(root.ply + ply.plyOffset, ply.san),
        ply: root.ply + ply.plyOffset,
        kind,
        laneRole,
        branchKey,
        lane,
        column,
        isLive: false,
        isReview: id === reviewId,
        isOnPlayedPath: false,
        isOnReviewPath: false,
        sourceNodeId: line.rootNodeId,
        uciFromParent: ply.uci,
      });
      edges.push({ fromId: parentId, toId: id, kind });
      parentId = id;
      parentCol = column;
    }
  }

  if (futureLine && shouldShowFuture(futureLine)) {
    attachProjectedLine(futureLine, "projected");
  }
  if (tutorLine && shouldShowTutor(tutorLine)) {
    attachProjectedLine(tutorLine, "tutor");
  }

  // --- Phase 4: review path ---
  const reviewPath = buildReviewPath(nodesById, reviewId, tree.rootId);

  for (const node of nodesById.values()) {
    node.isLive = node.id === liveId;
    node.isReview = node.id === reviewId;
    node.isOnPlayedPath = mainPathIds.has(node.id) || node.lane === LANE.played;
    node.isOnReviewPath = reviewPath.includes(node.id);
  }

  const nodes = [...nodesById.values()].sort((a, b) => {
    if (a.column !== b.column) return a.column - b.column;
    return b.lane - a.lane;
  });

  let maxLaneAbs = 0;
  let columns = 0;
  for (const node of nodes) {
    maxLaneAbs = Math.max(maxLaneAbs, Math.abs(node.lane));
    columns = Math.max(columns, node.column + 1);
  }

  return {
    nodes,
    edges,
    maxLaneAbs,
    columns,
    currentGamePath,
    reviewPath,
    liveTipColumn,
    overflowGroups,
  };
}

/** Walk parent links from selected node to root. */
export function buildReviewPath(
  nodesById: Map<string, TimelineGraphNode> | TimelineGraphNode[],
  selectedId: string,
  rootId: string,
): string[] {
  const map =
    nodesById instanceof Map
      ? nodesById
      : new Map(nodesById.map((n) => [n.id, n]));
  const path: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = selectedId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.push(cur);
    cur = map.get(cur)?.parentId ?? null;
  }
  path.reverse();
  if (path.length === 0 || path[0] !== rootId) {
    if (!path.includes(rootId)) path.unshift(rootId);
  }
  return path;
}

/**
 * Step along the focused branch: parent for −1, preferred child for +1.
 * Preferred child shares `branchKey` with the current node when possible.
 */
export function transportStep(
  graph: TimelineGraph,
  selectedId: string,
  delta: -1 | 1,
): string | null {
  const current = graph.nodes.find((n) => n.id === selectedId);
  if (!current || current.isOverflow) return null;

  if (delta < 0) {
    return current.parentId;
  }

  const children = graph.nodes
    .filter(
      (n) =>
        n.parentId === selectedId && !n.isOverflow && n.kind !== "projected",
    )
    .sort((a, b) => {
      // Prefer same branch, then played lane, then lower |lane|.
      const sameA = a.branchKey === current.branchKey ? 0 : 1;
      const sameB = b.branchKey === current.branchKey ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      if (a.lane === 0 && b.lane !== 0) return -1;
      if (b.lane === 0 && a.lane !== 0) return 1;
      return Math.abs(a.lane) - Math.abs(b.lane);
    });

  // Allow stepping into engine projection only from the live tip on the
  // played path when no committed child exists.
  if (children.length === 0 && current.isLive) {
    const projected = graph.nodes
      .filter((n) => n.parentId === selectedId && n.kind === "projected")
      .sort((a, b) => a.column - b.column);
    return projected[0]?.id ?? null;
  }

  return children[0]?.id ?? null;
}

/** Look up a graph node by id. */
export function getGraphNode(
  graph: TimelineGraph,
  nodeId: string,
): TimelineGraphNode | null {
  return graph.nodes.find((n) => n.id === nodeId) ?? null;
}

/** Resolve the fen for a review cursor against the graph / tree. */
export function resolveReviewFen(
  tree: GameTree,
  graph: TimelineGraph,
  reviewNodeId: string | null,
): string {
  const id = reviewNodeId ?? tree.currentNodeId;
  const graphNode = getGraphNode(graph, id);
  if (graphNode) return graphNode.fen;
  const treeNode = getNode(tree, id);
  return treeNode?.fen ?? getNode(tree, tree.rootId)?.fen ?? "";
}

export function isVirtualTimelineId(id: string): boolean {
  return id.startsWith("projected:") || id.startsWith("tutor:");
}

/**
 * Extract the UCI path from a virtual timeline id relative to its root.
 * `tutor:rootId:e2e4/e7e5` → `{ rootNodeId, uciPath: ['e2e4','e7e5'], kind }`
 */
export function parseVirtualTimelineId(id: string): {
  kind: "projected" | "tutor";
  rootNodeId: string;
  uciPath: string[];
} | null {
  const match = /^(projected|tutor):([^:]+):(.+)$/.exec(id);
  if (!match) return null;
  const kind = match[1] as "projected" | "tutor";
  const rootNodeId = match[2]!;
  const pathKey = match[3]!;
  return {
    kind,
    rootNodeId,
    uciPath: pathKey.split("/").filter(Boolean),
  };
}

export function laneRoleLabel(role: TimelineLaneRole): string {
  switch (role) {
    case "played":
      return "Current game";
    case "coach":
      return "Coach";
    case "engine":
      return "Engine";
    case "variationA":
    case "variationB":
      return "Variation";
    case "overflow":
      return "More branches";
  }
}
