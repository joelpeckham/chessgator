import { legalUciPrefix } from "@/domain/game/rules";
import {
  getNode,
  jumpToNode,
  playMoveOnTree,
  promoteVariation,
  pruneSubtree,
  pruneVariationChildren,
} from "@/domain/game/tree";
import type { GameNode, GameTree } from "@/domain/game/types";

export type VariationExplorerState = {
  /** Node where exploration began (exact restore target). */
  originNodeId: string;
  /** Validated UCI plies of the Stockfish (or coach) line. */
  lineUci: string[];
  /**
   * Node ids for each step: index 0 is origin, then one id per played ply.
   * Length is always `stepIndex + 1` while active, up to `lineUci.length + 1`.
   */
  pathNodeIds: string[];
  /** 0 = at origin; N = after N variation plies. */
  stepIndex: number;
};

/**
 * Validate a UCI line from `originFen`, stopping at the first illegal move.
 */
export function validateVariationLine(
  originFen: string,
  lineUci: readonly string[],
): string[] {
  return legalUciPrefix(originFen, lineUci);
}

export function createVariationExplorer(
  tree: GameTree,
  originNodeId: string,
  lineUci: readonly string[],
): { tree: GameTree; explorer: VariationExplorerState } | null {
  const origin = getNode(tree, originNodeId);
  if (!origin) return null;

  const validated = validateVariationLine(origin.fen, lineUci);
  if (validated.length === 0) return null;

  // Drop prior ghost siblings under the origin so a fresh line starts clean.
  const cleaned = pruneVariationChildren(tree, originNodeId);
  const atOrigin = jumpToNode(cleaned, originNodeId);
  if (!atOrigin) return null;

  return {
    tree: atOrigin,
    explorer: {
      originNodeId,
      lineUci: validated,
      pathNodeIds: [originNodeId],
      stepIndex: 0,
    },
  };
}

/**
 * Step one ply deeper into the variation, creating a flagged ghost node when needed.
 */
export function stepVariationForward(
  tree: GameTree,
  explorer: VariationExplorerState,
): { tree: GameTree; explorer: VariationExplorerState } | null {
  if (explorer.stepIndex >= explorer.lineUci.length) {
    return null;
  }

  const fromId = explorer.pathNodeIds[explorer.stepIndex];
  if (!fromId) return null;
  const uci = explorer.lineUci[explorer.stepIndex];
  if (!uci) return null;

  const played = playMoveOnTree(tree, fromId, uci, { asVariation: true });
  if (!played) return null;

  const nextIndex = explorer.stepIndex + 1;
  const pathNodeIds = explorer.pathNodeIds.slice(0, nextIndex);
  pathNodeIds.push(played.node.id);

  return {
    tree: played.tree,
    explorer: {
      ...explorer,
      pathNodeIds,
      stepIndex: nextIndex,
    },
  };
}

/** Step one ply back toward the origin (does not prune nodes). */
export function stepVariationBack(
  tree: GameTree,
  explorer: VariationExplorerState,
): { tree: GameTree; explorer: VariationExplorerState } | null {
  if (explorer.stepIndex <= 0) return null;
  const nextIndex = explorer.stepIndex - 1;
  const targetId = explorer.pathNodeIds[nextIndex];
  if (!targetId) return null;
  const jumped = jumpToNode(tree, targetId);
  if (!jumped) return null;
  return {
    tree: jumped,
    explorer: { ...explorer, stepIndex: nextIndex },
  };
}

/**
 * Return to the exact origin and prune ghost nodes created by this explorer.
 *
 * When the first PV ply reuses a committed child, deeper plies may still be
 * ghost descendants under that real node — strip those without deleting the
 * committed child or its legitimate non-variation descendants.
 */
export function exitVariationExplorer(
  tree: GameTree,
  explorer: VariationExplorerState,
): GameTree {
  let next = tree;

  // Deepest-first so pruning a ghost root removes its subtree before parents.
  for (let i = explorer.pathNodeIds.length - 1; i >= 1; i -= 1) {
    const id = explorer.pathNodeIds[i];
    if (!id) continue;
    const node = next.nodes[id];
    if (!node) continue;
    if (node.isVariation) {
      const pruned = pruneSubtree(next, id);
      if (pruned) next = pruned;
    } else {
      // Reused committed ply: remove only ghost children created underneath.
      next = pruneVariationChildren(next, id);
    }
  }

  next = pruneVariationChildren(next, explorer.originNodeId);
  return jumpToNode(next, explorer.originNodeId) ?? next;
}

/**
 * Commit a real alternate at the explorer origin ("Try instead"), prune remaining
 * ghosts under the origin, and leave the pointer on that move.
 *
 * Prefer `commitUci` (teaching `suggestedMoveUci`) so Try instead never replays
 * a mistake that happened to be the first ply of a refutation-style line.
 */
export function tryInsteadFromExplorer(
  tree: GameTree,
  explorer: VariationExplorerState,
  options?: { commitUci?: string | null },
): { tree: GameTree; node: GameNode } | null {
  const firstUci = options?.commitUci?.trim() || explorer.lineUci[0];
  if (!firstUci) return null;

  // Restore pointer to origin first; keep existing ghosts briefly so reuse works.
  let next = jumpToNode(tree, explorer.originNodeId);
  if (!next) return null;

  const played = playMoveOnTree(next, explorer.originNodeId, firstUci, {
    asVariation: false,
  });
  if (!played) return null;
  next = played.tree;

  // Promote in case reuse left ordering ambiguous, then drop other ghosts.
  const promoted = promoteVariation(next, played.node.id) ?? next;
  next = pruneVariationChildren(promoted, explorer.originNodeId);
  // Deeper plies of the explored line remain flagged under the first move —
  // strip those ghosts so Try instead only commits the first ply.
  next = pruneVariationChildren(next, played.node.id);

  // ensure the committed node still exists and is current
  const node = next.nodes[played.node.id];
  if (!node) return null;
  next = jumpToNode(next, node.id) ?? next;

  return { tree: next, node };
}
