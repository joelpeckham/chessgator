import type { AnalysisSummary } from "@/domain/analysis/types";
import { BOOTSTRAP_ROOT_ID, createNodeId } from "@/domain/game/id";
import {
  DEFAULT_POSITION,
  getStatusAlongPath,
  tryApplyMove,
} from "@/domain/game/rules";
import type {
  GameMove,
  GameNode,
  GameStatus,
  GameTree,
  MoveInput,
} from "@/domain/game/types";

export function createInitialTree(fen: string = DEFAULT_POSITION): GameTree {
  const rootId = createNodeId();
  return createTreeWithRootId(fen, rootId);
}

/** Create the deterministic tree used before the client store hydrates. */
export function createBootstrapTree(fen: string = DEFAULT_POSITION): GameTree {
  return createTreeWithRootId(fen, BOOTSTRAP_ROOT_ID);
}

function createTreeWithRootId(fen: string, rootId: string): GameTree {
  const root: GameNode = {
    id: rootId,
    parentId: null,
    childIds: [],
    fen,
    move: null,
    ply: 0,
    analysis: null,
    isVariation: false,
  };
  return {
    nodes: { [rootId]: root },
    rootId,
    currentNodeId: rootId,
  };
}

export function getNode(tree: GameTree, nodeId: string): GameNode | null {
  return tree.nodes[nodeId] ?? null;
}

export function getCurrentNode(tree: GameTree): GameNode {
  const node = tree.nodes[tree.currentNodeId];
  if (!node) {
    throw new Error(`Missing current node: ${tree.currentNodeId}`);
  }
  return node;
}

/** Walk parent links from node to root (root first). Cycle-safe. */
export function getAncestors(tree: GameTree, nodeId: string): GameNode[] {
  const path: GameNode[] = [];
  const visited = new Set<string>();
  let current = tree.nodes[nodeId];
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    path.push(current);
    if (!current.parentId) break;
    current = tree.nodes[current.parentId];
  }
  return path.reverse();
}

/** Moves from root to the given node (excludes root). */
export function getMoveHistory(tree: GameTree, nodeId: string): GameMove[] {
  return getAncestors(tree, nodeId)
    .map((node) => node.move)
    .filter((move): move is GameMove => move !== null);
}

export function getPathFenHistory(tree: GameTree, nodeId: string): string[] {
  return getAncestors(tree, nodeId).map((node) => node.fen);
}

export function getStatusAtNode(tree: GameTree, nodeId: string): GameStatus {
  const root = tree.nodes[tree.rootId];
  if (!root) {
    throw new Error(`Missing root node: ${tree.rootId}`);
  }
  return getStatusAlongPath(root.fen, getMoveHistory(tree, nodeId));
}

function cloneNodes(
  nodes: Readonly<Record<string, GameNode>>,
): Record<string, GameNode> {
  const next: Record<string, GameNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    next[id] = { ...node, childIds: [...node.childIds] };
  }
  return next;
}

function movesEqual(a: GameMove, b: GameMove): boolean {
  return a.uci === b.uci;
}

export type PlayMoveOnTreeOptions = {
  /** When true, the new (or matched) node is marked as a ghost variation. */
  asVariation?: boolean;
};

/**
 * Apply a legal move at `fromNodeId`, reusing an existing child branch when the
 * same UCI was already played. Returns null if the move is illegal.
 */
export function playMoveOnTree(
  tree: GameTree,
  fromNodeId: string,
  input: MoveInput,
  options?: PlayMoveOnTreeOptions,
): { tree: GameTree; node: GameNode; created: boolean } | null {
  const fromNode = tree.nodes[fromNodeId];
  if (!fromNode) {
    return null;
  }

  const asVariation = options?.asVariation === true;
  const history = getMoveHistory(tree, fromNodeId);
  const applied = tryApplyMove(fromNode.fen, input);
  if (!applied) {
    return null;
  }

  // Prefer matching an existing child so navigation can revisit branches.
  for (const childId of fromNode.childIds) {
    const child = tree.nodes[childId];
    if (child?.move && movesEqual(child.move, applied.move)) {
      if (asVariation) {
        return {
          tree: { ...tree, currentNodeId: child.id },
          node: child,
          created: false,
        };
      }
      // Real commit: clear ghost flag and make this the preferred mainline child.
      const nodes = cloneNodes(tree.nodes);
      nodes[child.id] = { ...child, isVariation: false };
      const parent = nodes[fromNode.id]!;
      const rest = parent.childIds.filter((id) => id !== child.id);
      nodes[fromNode.id] = {
        ...parent,
        childIds: [child.id, ...rest],
      };
      return {
        tree: { ...tree, nodes, currentNodeId: child.id },
        node: nodes[child.id]!,
        created: false,
      };
    }
  }

  // Replay through path so threefold / fifty-move flags stay accurate.
  const status = getStatusAlongPath(tree.nodes[tree.rootId]!.fen, [
    ...history,
    applied.move,
  ]);

  const childId = createNodeId();
  const child: GameNode = {
    id: childId,
    parentId: fromNode.id,
    childIds: [],
    fen: status.fen,
    move: applied.move,
    ply: fromNode.ply + 1,
    analysis: null,
    isVariation: asVariation,
  };

  const nodes = cloneNodes(tree.nodes);
  const parent = nodes[fromNode.id]!;
  // Newly committed real moves become the preferred mainline child; ghosts append.
  const nextChildIds = asVariation
    ? [...parent.childIds, childId]
    : [childId, ...parent.childIds];
  nodes[fromNode.id] = {
    ...parent,
    childIds: nextChildIds,
  };
  nodes[childId] = child;

  return {
    tree: {
      nodes,
      rootId: tree.rootId,
      currentNodeId: childId,
    },
    node: child,
    created: true,
  };
}

export function jumpToNode(
  tree: GameTree,
  nodeId: string,
): GameTree | null {
  if (!tree.nodes[nodeId]) {
    return null;
  }
  return { ...tree, currentNodeId: nodeId };
}

/** Move the pointer to the parent of the current node (takeback / retry base). */
export function takebackOne(tree: GameTree): GameTree | null {
  const current = tree.nodes[tree.currentNodeId];
  if (!current?.parentId) {
    return null;
  }
  return jumpToNode(tree, current.parentId);
}

export function setNodeAnalysis(
  tree: GameTree,
  nodeId: string,
  analysis: AnalysisSummary | null,
): GameTree | null {
  const node = tree.nodes[nodeId];
  if (!node) {
    return null;
  }
  const nodes = cloneNodes(tree.nodes);
  nodes[nodeId] = { ...node, analysis };
  return { ...tree, nodes };
}

/**
 * First committed (non-variation) child.
 * Ghost exploration lines stay siblings without stealing the main line.
 */
export function listMainlineChild(
  tree: GameTree,
  nodeId: string,
): GameNode | null {
  const node = tree.nodes[nodeId];
  if (!node || node.childIds.length === 0) {
    return null;
  }
  for (const childId of node.childIds) {
    const child = tree.nodes[childId];
    if (child && !child.isVariation) {
      return child;
    }
  }
  return null;
}

/** Collect variation siblings under a node (direct children only). */
export function listVariationChildren(
  tree: GameTree,
  nodeId: string,
): GameNode[] {
  const node = tree.nodes[nodeId];
  if (!node) return [];
  return node.childIds
    .map((id) => tree.nodes[id])
    .filter((child): child is GameNode => Boolean(child?.isVariation));
}

/** Walk the committed main line from root (includes root). Cycle-safe. */
export function getMainlinePath(tree: GameTree): GameNode[] {
  const path: GameNode[] = [];
  const visited = new Set<string>();
  let current: GameNode | null | undefined = tree.nodes[tree.rootId];
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    path.push(current);
    current = listMainlineChild(tree, current.id);
  }
  return path;
}

/**
 * Promote a variation node onto the committed main line: clear the flag and
 * move it ahead of siblings under its parent.
 */
export function promoteVariation(
  tree: GameTree,
  nodeId: string,
): GameTree | null {
  const node = tree.nodes[nodeId];
  if (!node) return null;

  const nodes = cloneNodes(tree.nodes);
  nodes[nodeId] = { ...node, isVariation: false };

  if (node.parentId) {
    const parent = nodes[node.parentId];
    if (parent) {
      const rest = parent.childIds.filter((id) => id !== nodeId);
      nodes[node.parentId] = {
        ...parent,
        childIds: [nodeId, ...rest],
      };
    }
  }

  return { ...tree, nodes, currentNodeId: nodeId };
}

/**
 * Remove a node and all of its descendants. Parent childIds are updated.
 * Refuses to delete the root. If `currentNodeId` is removed, jumps to parent.
 */
export function pruneSubtree(
  tree: GameTree,
  nodeId: string,
): GameTree | null {
  if (nodeId === tree.rootId) return null;
  const start = tree.nodes[nodeId];
  if (!start) return null;

  const toRemove = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (toRemove.has(id)) continue;
    toRemove.add(id);
    const node = tree.nodes[id];
    if (node) stack.push(...node.childIds);
  }

  const nodes = cloneNodes(tree.nodes);
  for (const id of toRemove) {
    delete nodes[id];
  }

  if (start.parentId && nodes[start.parentId]) {
    const parent = nodes[start.parentId]!;
    nodes[start.parentId] = {
      ...parent,
      childIds: parent.childIds.filter((id) => !toRemove.has(id)),
    };
  }

  let currentNodeId = tree.currentNodeId;
  if (toRemove.has(currentNodeId)) {
    currentNodeId = start.parentId ?? tree.rootId;
  }

  return {
    nodes,
    rootId: tree.rootId,
    currentNodeId,
  };
}

/**
 * Prune every direct variation child (and its subtree) under `originNodeId`.
 * Committed children are left intact.
 */
export function pruneVariationChildren(
  tree: GameTree,
  originNodeId: string,
): GameTree {
  const origin = tree.nodes[originNodeId];
  if (!origin) return tree;

  let next = tree;
  for (const childId of [...origin.childIds]) {
    const child = next.nodes[childId];
    if (child?.isVariation) {
      const pruned = pruneSubtree(next, childId);
      if (pruned) next = pruned;
    }
  }
  return next;
}
