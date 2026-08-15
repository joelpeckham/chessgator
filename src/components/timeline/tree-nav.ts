import type {
  DecisionGraph,
  DecisionGraphNode,
} from "@/components/timeline/decision-types";

function nodeById(
  graph: DecisionGraph,
  id: string,
): DecisionGraphNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

function childIds(graph: DecisionGraph, fromId: string): string[] {
  const committed: string[] = [];
  const tutor: string[] = [];
  for (const edge of graph.edges) {
    if (edge.fromId !== fromId) continue;
    const child = nodeById(graph, edge.toId);
    if (!child || child.kind === "projected") continue;
    if (child.kind === "tutor") tutor.push(child.id);
    else committed.push(child.id);
  }
  return [...committed, ...tutor];
}

export function parentNodeId(
  graph: DecisionGraph,
  nodeId: string,
): string | null {
  return nodeById(graph, nodeId)?.parentId ?? null;
}

export function firstChildNodeId(
  graph: DecisionGraph,
  nodeId: string,
): string | null {
  return childIds(graph, nodeId)[0] ?? null;
}

export function branchTipId(graph: DecisionGraph, nodeId: string): string {
  let current = nodeId;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const next = firstChildNodeId(graph, current);
    if (!next) return current;
    current = next;
  }
  return current;
}

/** Same-parent siblings ordered by lane (high lane first, matching ArrowUp). */
export function siblingsAtParent(
  graph: DecisionGraph,
  nodeId: string,
): DecisionGraphNode[] {
  const current = nodeById(graph, nodeId);
  if (!current) return [];
  return graph.nodes
    .filter(
      (node) => node.parentId === current.parentId && node.kind !== "projected",
    )
    .toSorted((a, b) => b.lane - a.lane);
}

/** ArrowUp is +1 (higher lane); ArrowDown is -1. */
export function stepSiblingLane(
  graph: DecisionGraph,
  nodeId: string,
  delta: -1 | 1,
): string | null {
  const siblings = siblingsAtParent(graph, nodeId);
  const idx = siblings.findIndex((node) => node.id === nodeId);
  if (idx < 0) return null;
  return siblings[idx - delta]?.id ?? null;
}

export function transportStep(
  graph: DecisionGraph,
  cursorId: string,
  delta: -1 | 1,
): string | null {
  if (delta === -1) return parentNodeId(graph, cursorId);
  return firstChildNodeId(graph, cursorId);
}
