import {
  getAncestors,
  getNode,
  listMainlineChild,
  type GameNode,
  type GameTree,
} from "@/domain/game";

export type TimelineEntry = {
  node: GameNode;
  plyLabel: string;
  san: string;
  isCurrent: boolean;
  isOnPath: boolean;
  isVariation: boolean;
  branchAlternates: GameNode[];
};

function plyLabelFor(node: GameNode): string {
  if (!node.move) return "Start";
  const moveNo = Math.floor((node.ply + 1) / 2);
  return node.move.color === "w" ? `${moveNo}.` : `${moveNo}...`;
}

/**
 * Legacy vertical-list timeline entries. Prefer `buildBranchGraph` for the
 * board-first UI; kept for existing unit coverage of branch alternates.
 */
export function buildTimelineEntries(tree: GameTree): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const ancestors = getAncestors(tree, tree.currentNodeId);
  const pathIds = new Set(ancestors.map((n) => n.id));

  for (const node of ancestors) {
    const mainChild = listMainlineChild(tree, node.id);
    const alternates = node.childIds
      .map((id) => tree.nodes[id])
      .filter((child): child is GameNode => {
        if (!child) return false;
        if (pathIds.has(child.id)) return false;
        if (mainChild && child.id === mainChild.id) return false;
        return true;
      });

    entries.push({
      node,
      plyLabel: node.move ? plyLabelFor(node) : "",
      san: node.move?.san ?? "Start",
      isCurrent: tree.currentNodeId === node.id,
      isOnPath: true,
      isVariation: node.isVariation,
      branchAlternates: alternates,
    });
  }

  let cursor = listMainlineChild(tree, tree.currentNodeId);
  while (cursor) {
    const parent = cursor.parentId ? getNode(tree, cursor.parentId) : null;
    const alternates =
      parent?.childIds
        .filter((id) => id !== cursor!.id)
        .map((id) => tree.nodes[id])
        .filter((n): n is GameNode => Boolean(n)) ?? [];

    entries.push({
      node: cursor,
      plyLabel: plyLabelFor(cursor),
      san: cursor.move?.san ?? "…",
      isCurrent: false,
      isOnPath: false,
      isVariation: cursor.isVariation,
      branchAlternates: alternates,
    });
    cursor = listMainlineChild(tree, cursor.id);
  }

  return entries;
}
