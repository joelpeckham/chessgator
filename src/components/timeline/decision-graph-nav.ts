import type {
  DecisionGraph,
  DecisionGraphNode,
} from "@/components/timeline/decision-types";

export function siblingsAtColumn(
  graph: DecisionGraph,
  nodeId: string,
): DecisionGraphNode[] {
  const current = graph.nodes.find((node) => node.id === nodeId);
  if (!current) return [];
  return graph.nodes
    .filter(
      (node) => node.column === current.column && node.kind !== "overflow",
    )
    .toSorted((a, b) => b.lane - a.lane);
}

/** ArrowUp is +1 (higher lane); ArrowDown is -1. */
export function stepForkLane(
  graph: DecisionGraph,
  nodeId: string,
  delta: -1 | 1,
): string | null {
  const siblings = siblingsAtColumn(graph, nodeId);
  const idx = siblings.findIndex((node) => node.id === nodeId);
  if (idx < 0) return null;
  return siblings[idx - delta]?.id ?? null;
}

function nodeById(
  graph: DecisionGraph,
  id: string,
): DecisionGraphNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

/**
 * Left/right follow the pinned branch, then the cursor's branch, then live.
 * Overflow hubs are never transport destinations.
 */
export function transportStep(
  graph: DecisionGraph,
  cursorId: string,
  delta: -1 | 1,
  pinnedBranchId?: string | null,
): string | null {
  const current = nodeById(graph, cursorId);
  if (!current) {
    return graph.nodes.find((node) => node.kind !== "overflow")?.id ?? null;
  }
  if (delta === -1) {
    if (!current.parentId) return null;
    return nodeById(graph, current.parentId) ? current.parentId : null;
  }

  const childIds = graph.edges
    .filter((edge) => edge.fromId === cursorId)
    .map((edge) => edge.toId)
    .filter((id) => nodeById(graph, id)?.kind !== "overflow");

  const preferred = pinnedBranchId ?? current.branchId;
  const pinnedChild = childIds.find(
    (id) => nodeById(graph, id)?.branchId === preferred,
  );
  if (pinnedChild) return pinnedChild;

  const sameBranch = childIds.find(
    (id) => nodeById(graph, id)?.branchId === current.branchId,
  );
  if (sameBranch) return sameBranch;

  const liveChild = childIds.find(
    (id) => nodeById(graph, id)?.branchId === "live",
  );
  return liveChild ?? childIds[0] ?? null;
}
