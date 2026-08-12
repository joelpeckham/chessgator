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

export type TimelineGraphNode = {
  id: string;
  parentId: string | null;
  fen: string;
  san: string | null;
  ply: number;
  kind: TimelineNodeKind;
  /** 0 = main line; positive = above; negative = below. */
  lane: number;
  column: number;
  /** Matches the live game playhead (`tree.currentNodeId`). */
  isLive: boolean;
  /** Matches the ephemeral review cursor. */
  isReview: boolean;
  /**
   * For projected/tutor nodes: the committed tree node the line branches from.
   * For committed/variation: the tree node id (same as `id`).
   */
  sourceNodeId: string;
  uciFromParent: string | null;
  /** True when this node is a collapsed "+N" overflow sentinel. */
  isOverflow?: boolean;
  overflowCount?: number;
};

export type TimelineGraphEdge = {
  fromId: string;
  toId: string;
  kind: TimelineNodeKind;
};

export type TimelineGraph = {
  nodes: TimelineGraphNode[];
  edges: TimelineGraphEdge[];
  /** Max absolute lane used (for vertical sizing). */
  maxLaneAbs: number;
  columns: number;
};

export type BuildBranchGraphInput = {
  tree: GameTree;
  /** Ephemeral review cursor; null follows the live playhead. */
  reviewNodeId?: string | null;
  /** Best-play future from the review/live tip. */
  futureLine?: ProjectedLine | null;
  /** Tutor alternate line (e.g. improvement from before the last move). */
  tutorLine?: ProjectedLine | null;
  /** Max branch lanes above and below the main line (each side). */
  maxLaneSide?: number;
};

const MAX_LANE_SIDE_DEFAULT = 2;

function plyLabelSan(node: GameNode): string | null {
  return node.move?.san ?? null;
}

function virtualId(kind: "projected" | "tutor", rootId: string, pathKey: string): string {
  return `${kind}:${rootId}:${pathKey}`;
}

/**
 * Build a horizontal branch graph: committed mainline + sibling branches +
 * optional projected future / tutor alternate lines.
 *
 * Lane 0 is the path from root through the live tip (or its preferred mainline
 * continuation). Sibling branches and tutor/future lines occupy lanes ±1…±N;
 * excess siblings collapse into an overflow sentinel.
 */
export function buildBranchGraph(input: BuildBranchGraphInput): TimelineGraph {
  const {
    tree,
    futureLine = null,
    tutorLine = null,
    maxLaneSide = MAX_LANE_SIDE_DEFAULT,
  } = input;
  const liveId = tree.currentNodeId;
  const reviewId = input.reviewNodeId ?? liveId;

  const nodesById = new Map<string, TimelineGraphNode>();
  const edges: TimelineGraphEdge[] = [];

  // Main path: ancestors of live tip, then committed mainline continuation.
  const liveAncestors = getAncestors(tree, liveId);
  const mainPath: GameNode[] = [...liveAncestors];
  let cursor = listMainlineChild(tree, liveId);
  while (cursor) {
    mainPath.push(cursor);
    cursor = listMainlineChild(tree, cursor.id);
  }

  const mainPathIds = new Set(mainPath.map((n) => n.id));
  const columnById = new Map<string, number>();

  mainPath.forEach((node, column) => {
    columnById.set(node.id, column);
    const kind: TimelineNodeKind = node.isVariation ? "variation" : "committed";
    nodesById.set(node.id, {
      id: node.id,
      parentId: node.parentId,
      fen: node.fen,
      san: plyLabelSan(node),
      ply: node.ply,
      kind,
      lane: 0,
      column,
      isLive: node.id === liveId,
      isReview: node.id === reviewId,
      sourceNodeId: node.id,
      uciFromParent: node.move?.uci ?? null,
    });
    if (node.parentId) {
      edges.push({ fromId: node.parentId, toId: node.id, kind });
    }
  });

  // Assign lanes to sibling branches off the main path.
  type PendingBranch = {
    node: GameNode;
    parentId: string;
    preferredLane: number;
  };
  const pending: PendingBranch[] = [];
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

  /**
   * Reserve a free lane at `column`, preferring `preferred`.
   * Side-line requests (preferred ≠ 0) never steal lane 0.
   */
  function reserveLane(column: number, preferred: number): number | null {
    const used = lanesAt(column);
    const candidates = [preferred];
    for (let i = 1; i <= maxLaneSide; i += 1) {
      candidates.push(i, -i);
    }
    for (const lane of candidates) {
      if (lane !== 0 && Math.abs(lane) > maxLaneSide) continue;
      if (preferred !== 0 && lane === 0) continue;
      if (!used.has(lane)) {
        used.add(lane);
        return lane;
      }
    }
    return null;
  }

  // Seed lane 0 as used on every main-path column (without claiming ±1).
  for (const node of mainPath) {
    markLaneUsed(columnById.get(node.id)!, 0);
  }

  let laneSign = 1;
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
      });

    let overflow = 0;
    for (const sibling of siblings) {
      const preferred = laneSign > 0 ? laneSign : laneSign;
      const lane = reserveLane(parentCol + 1, preferred === 0 ? 1 : preferred);
      laneSign = -laneSign;
      if (lane == null) {
        overflow += 1;
        continue;
      }
      pending.push({ node: sibling, parentId: parent.id, preferredLane: lane });
    }

    if (overflow > 0) {
      const overflowId = `overflow:${parent.id}`;
      const overflowCol = parentCol + 1;
      nodesById.set(overflowId, {
        id: overflowId,
        parentId: parent.id,
        fen: parent.fen,
        san: `+${overflow}`,
        ply: parent.ply + 1,
        kind: "variation",
        lane: maxLaneSide,
        column: overflowCol,
        isLive: false,
        isReview: false,
        sourceNodeId: parent.id,
        uciFromParent: null,
        isOverflow: true,
        overflowCount: overflow,
      });
      edges.push({ fromId: parent.id, toId: overflowId, kind: "variation" });
    }
  }

  // Place first ply of each branch, then walk each branch's preferred child chain
  // on the same lane (capped length so the graph stays readable).
  const BRANCH_FORWARD_PLIES = 8;
  for (const branch of pending) {
    const parentCol = columnById.get(branch.parentId) ?? 0;
    let current: GameNode | null = branch.node;
    let parentId = branch.parentId;
    let col = parentCol + 1;
    for (let depth = 0; current && depth < BRANCH_FORWARD_PLIES; depth += 1) {
      if (nodesById.has(current.id)) break;
      const kind: TimelineNodeKind = current.isVariation
        ? "variation"
        : "committed";
      // First ply was reserved when the branch was queued; keep later plies sticky.
      if (depth > 0) markLaneUsed(col, branch.preferredLane);
      columnById.set(current.id, col);
      nodesById.set(current.id, {
        id: current.id,
        parentId,
        fen: current.fen,
        san: plyLabelSan(current),
        ply: current.ply,
        kind,
        lane: branch.preferredLane,
        column: col,
        isLive: current.id === liveId,
        isReview: current.id === reviewId,
        sourceNodeId: current.id,
        uciFromParent: current.move?.uci ?? null,
      });
      edges.push({ fromId: parentId, toId: current.id, kind });

      parentId = current.id;
      col += 1;
      const nextChildId = current.childIds[0];
      if (!nextChildId) {
        current = null;
        break;
      }
      const next = getNode(tree, nextChildId);
      if (!next || mainPathIds.has(next.id)) break;
      current = next;
    }
  }

  function attachProjectedLine(
    line: ProjectedLine,
    kind: "projected" | "tutor",
    preferredLane: number,
  ): void {
    const root = nodesById.get(line.rootNodeId);
    if (!root) return;

    let parentId = line.rootNodeId;
    let parentCol = root.column;
    /** Sticky lane for this virtual line once the first virtual ply is placed. */
    let lineLane: number | null = null;

    for (const ply of line.plies) {
      const id = virtualId(kind, line.rootNodeId, ply.pathKey);
      // If this ply already exists as a committed/variation child, reuse it.
      const parentNode = getNode(tree, parentId);
      const existingChild = parentNode?.childIds
        .map((cid) => tree.nodes[cid])
        .find((c) => c?.move?.uci === ply.uci);
      if (existingChild && nodesById.has(existingChild.id)) {
        const existing = nodesById.get(existingChild.id)!;
        parentId = existingChild.id;
        parentCol = existing.column;
        // Following a real node does not start/alter the virtual line's lane.
        continue;
      }
      if (existingChild && !nodesById.has(existingChild.id)) {
        // Unexpected — skip virtual if tree already has it but not placed.
        parentId = existingChild.id;
        parentCol += 1;
        continue;
      }

      const column = parentCol + 1;
      const prefer =
        lineLane ??
        (kind === "projected"
          ? root.lane === 0
            ? 0
            : root.lane
          : preferredLane);
      const reserved = reserveLane(column, prefer);
      if (reserved == null) break;
      const lane = reserved;
      lineLane = lane;

      nodesById.set(id, {
        id,
        parentId,
        fen: ply.fen,
        san: ply.san,
        ply: root.ply + ply.plyOffset,
        kind,
        lane,
        column,
        isLive: false,
        isReview: id === reviewId,
        sourceNodeId: line.rootNodeId,
        uciFromParent: ply.uci,
      });
      edges.push({ fromId: parentId, toId: id, kind });
      parentId = id;
      parentCol = column;
    }
  }

  // Future continues from the tip of the main path (live tip's mainline leaf,
  // or the live node itself when there is no continuation).
  if (futureLine) {
    attachProjectedLine(futureLine, "projected", 0);
  }

  // Tutor alternate prefers the first free positive lane.
  if (tutorLine) {
    attachProjectedLine(tutorLine, "tutor", 1);
  }

  // Re-mark review/live in case projected ids match reviewNodeId.
  for (const node of nodesById.values()) {
    node.isLive = node.id === liveId;
    node.isReview = node.id === reviewId;
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

  return { nodes, edges, maxLaneAbs, columns };
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
