import type {
  DecisionGraph,
  DecisionGraphEdge,
  DecisionGraphNode,
  DecisionGraphNodeKind,
} from "@/components/timeline/decision-types";
import {
  type LayoutInputNode,
  layoutTree,
  nearestFreeLane,
} from "@/components/timeline/tree-layout";
import { virtualId } from "@/components/timeline/virtual-id";
import type { ProjectedLine } from "@/domain/analysis";
import {
  type Color,
  type GameTree,
  getAncestors,
  getNode,
  getTurn,
} from "@/domain/game";

export function formatMoveLabel(ply: number, san: string | null): string {
  if (!san) return "start";
  const moveNumber = Math.floor((ply + 1) / 2);
  if (ply % 2 === 1) return `${moveNumber}.${san}`;
  return `${moveNumber}…${san}`;
}

export function lastHumanDecisionId(
  tree: GameTree,
  humanColor: Color,
): string | null {
  const path = getAncestors(tree, tree.currentNodeId);
  for (let i = path.length - 1; i >= 1; i -= 1) {
    const node = path[i]!;
    if (node.move?.color === humanColor) return node.id;
  }
  return null;
}

export function analyzedNodeIdForFocus(args: {
  tree: GameTree;
  focusNodeId: string;
  humanColor: Color;
}): string | null {
  const node = getNode(args.tree, args.focusNodeId);
  if (!node) return lastHumanDecisionId(args.tree, args.humanColor);
  if (!node.move) return null;
  if (node.move.color === args.humanColor) return node.id;
  if (node.parentId) {
    const parent = getNode(args.tree, node.parentId);
    if (parent?.move?.color === args.humanColor) return parent.id;
  }
  return lastHumanDecisionId(args.tree, args.humanColor);
}

function pushNode(nodes: DecisionGraphNode[], node: DecisionGraphNode): void {
  if (nodes.some((existing) => existing.id === node.id)) return;
  nodes.push(node);
}

function pushEdge(
  edges: DecisionGraphEdge[],
  fromId: string,
  toId: string,
  kind: DecisionGraphNodeKind,
): void {
  if (edges.some((edge) => edge.fromId === fromId && edge.toId === toId)) {
    return;
  }
  edges.push({ fromId, toId, kind });
}

function usedLanesAtColumn(
  nodes: readonly DecisionGraphNode[],
  column: number,
): Set<number> {
  const used = new Set<number>();
  for (const node of nodes) {
    if (node.column === column) used.add(node.lane);
  }
  return used;
}

function childMatchingUci(
  tree: GameTree,
  parentId: string,
  uci: string,
): string | null {
  const parent = getNode(tree, parentId);
  if (!parent) return null;
  const needle = uci.toLowerCase();
  for (const childId of parent.childIds) {
    const child = tree.nodes[childId];
    if (child?.move?.uci.toLowerCase() === needle) return child.id;
  }
  return null;
}

export function buildTreeGraph(args: {
  tree: GameTree;
  suggestedMove: ProjectedLine | null;
}): DecisionGraph {
  const { tree } = args;
  const input: Record<string, LayoutInputNode> = {};
  for (const node of Object.values(tree.nodes)) {
    input[node.id] = {
      id: node.id,
      parentId: node.parentId,
      ply: node.ply,
      childIds: node.childIds,
    };
  }
  const bornAt = new Map(
    Object.keys(tree.nodes).map((id, index) => [id, index]),
  );
  const layout = layoutTree(input, tree.rootId, bornAt);

  const nodes: DecisionGraphNode[] = [];
  const edges: DecisionGraphEdge[] = [];

  for (const node of Object.values(tree.nodes)) {
    const pos = layout.positions.get(node.id);
    if (!pos) continue;
    pushNode(nodes, {
      id: node.id,
      parentId: node.parentId,
      column: pos.column,
      lane: pos.lane,
      kind: "committed",
      san: node.move?.san ?? "",
      moveLabel: formatMoveLabel(node.ply, node.move?.san ?? null),
      caption: null,
      isCurrent: node.id === tree.currentNodeId,
      fen: node.fen,
      uci: node.move?.uci ?? null,
      moveColor: node.move?.color ?? null,
    });
    if (node.parentId) {
      pushEdge(edges, node.parentId, node.id, "committed");
    }
  }

  let minLane = layout.minLane;
  let maxLane = layout.maxLane;
  let columns = layout.columns;

  const suggestedPly = args.suggestedMove?.plies[0];
  if (suggestedPly && args.suggestedMove) {
    const fromId = args.suggestedMove.rootNodeId;
    const alreadyPlayed = childMatchingUci(tree, fromId, suggestedPly.uci);
    const originPos = layout.positions.get(fromId);
    if (originPos && !alreadyPlayed) {
      const column = originPos.column + 1;
      const lane = nearestFreeLane(
        usedLanesAtColumn(nodes, column),
        originPos.lane + 1,
      );
      const id = virtualId(fromId, suggestedPly.uci);
      const origin = getNode(tree, fromId);
      const plyNumber = (origin?.ply ?? 0) + suggestedPly.plyOffset;
      pushNode(nodes, {
        id,
        parentId: fromId,
        column,
        lane,
        kind: "suggested",
        san: suggestedPly.san,
        moveLabel: formatMoveLabel(plyNumber, suggestedPly.san),
        caption: "Gator",
        isCurrent: false,
        fen: suggestedPly.fen,
        uci: suggestedPly.uci,
        moveColor: origin ? getTurn(origin.fen) : null,
      });
      pushEdge(edges, fromId, id, "suggested");
      if (lane < minLane) minLane = lane;
      if (lane > maxLane) maxLane = lane;
      if (column + 1 > columns) columns = column + 1;
    }
  }

  return { nodes, edges, columns, minLane, maxLane };
}
