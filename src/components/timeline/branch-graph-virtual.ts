import type {
  TimelineGraph,
  TimelineGraphNode,
  TimelineLaneRole,
} from "@/components/timeline/branch-graph-types";
import type { GameTree } from "@/domain/game";
import { getNode } from "@/domain/game";

export function virtualId(
  kind: "projected" | "tutor",
  rootId: string,
  pathKey: string,
): string {
  return `${kind}:${rootId}:${pathKey}`;
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
  const ordered = path.toReversed();
  if (ordered.length === 0 || ordered[0] !== rootId) {
    if (!ordered.includes(rootId)) ordered.unshift(rootId);
  }
  return ordered;
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
    .toSorted((a, b) => {
      const sameA = a.branchKey === current.branchKey ? 0 : 1;
      const sameB = b.branchKey === current.branchKey ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      if (a.lane === 0 && b.lane !== 0) return -1;
      if (b.lane === 0 && a.lane !== 0) return 1;
      return Math.abs(a.lane) - Math.abs(b.lane);
    });

  if (children.length === 0 && current.isLive) {
    const projected = graph.nodes
      .filter((n) => n.parentId === selectedId && n.kind === "projected")
      .toSorted((a, b) => a.column - b.column);
    return projected[0]?.id ?? null;
  }

  return children[0]?.id ?? null;
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
