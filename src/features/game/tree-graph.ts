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
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import { isProminentLesson } from "@/features/game/learning-moments";

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

/**
 * Drop tutor prefix plies that already exist as real children so the dotted
 * rail only shows unrealized suggestions.
 */
export function unrealizedTutorStart(args: {
  tree: GameTree;
  originId: string;
  line: ProjectedLine;
}): { fromId: string; plies: ProjectedLine["plies"] } {
  let fromId = args.originId;
  let start = 0;
  for (const ply of args.line.plies) {
    const existing = childMatchingUci(args.tree, fromId, ply.uci);
    if (!existing) break;
    fromId = existing;
    start += 1;
  }
  return { fromId, plies: args.line.plies.slice(start) };
}

export function buildTreeGraph(args: {
  tree: GameTree;
  lessons: Readonly<Record<string, TeachingInsight>>;
  tutorLine: ProjectedLine | null;
  futureLine: ProjectedLine | null;
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
    const lesson = args.lessons[node.id];
    pushNode(nodes, {
      id: node.id,
      parentId: node.parentId,
      column: pos.column,
      lane: pos.lane,
      kind: "committed",
      san: node.move?.san ?? "",
      moveLabel: formatMoveLabel(node.ply, node.move?.san ?? null),
      caption: null,
      prominent: lesson ? isProminentLesson(lesson) : false,
      isCurrent: node.id === tree.currentNodeId,
      fen: node.fen,
    });
    if (node.parentId) {
      pushEdge(edges, node.parentId, node.id, "committed");
    }
  }

  let minLane = layout.minLane;
  let maxLane = layout.maxLane;
  let columns = layout.columns;

  if (args.tutorLine && args.tutorLine.plies.length > 0) {
    const { fromId, plies } = unrealizedTutorStart({
      tree,
      originId: args.tutorLine.rootNodeId,
      line: args.tutorLine,
    });
    const originPos = layout.positions.get(fromId);
    if (originPos && plies.length > 0) {
      const firstColumn = originPos.column + 1;
      const lane = nearestFreeLane(
        usedLanesAtColumn(nodes, firstColumn),
        originPos.lane + 1,
      );
      let parentId = fromId;
      for (const [index, ply] of plies.entries()) {
        const id = virtualId("tutor", args.tutorLine.rootNodeId, ply.pathKey);
        const column = firstColumn + index;
        const origin = getNode(tree, args.tutorLine.rootNodeId);
        const plyNumber = (origin?.ply ?? 0) + ply.plyOffset;
        pushNode(nodes, {
          id,
          parentId,
          column,
          lane,
          kind: "tutor",
          san: ply.san,
          moveLabel: formatMoveLabel(plyNumber, ply.san),
          caption: index === 0 ? "Gator" : null,
          prominent: false,
          isCurrent: false,
          fen: ply.fen,
        });
        pushEdge(edges, parentId, id, "tutor");
        parentId = id;
        if (lane < minLane) minLane = lane;
        if (lane > maxLane) maxLane = lane;
        if (column + 1 > columns) columns = column + 1;
      }
    }
  }

  const futureHead = args.futureLine?.plies[0];
  if (futureHead && args.futureLine) {
    const currentPos = layout.positions.get(tree.currentNodeId);
    if (currentPos) {
      const column = currentPos.column + 1;
      const occupied = usedLanesAtColumn(nodes, column);
      if (!occupied.has(currentPos.lane)) {
        const id = virtualId(
          "projected",
          args.futureLine.rootNodeId,
          futureHead.pathKey,
        );
        pushNode(nodes, {
          id,
          parentId: tree.currentNodeId,
          column,
          lane: currentPos.lane,
          kind: "projected",
          san: futureHead.san,
          moveLabel: futureHead.san,
          caption: null,
          prominent: false,
          isCurrent: false,
          fen: futureHead.fen,
        });
        pushEdge(edges, tree.currentNodeId, id, "projected");
        if (column + 1 > columns) columns = column + 1;
      }
    }
  }

  return { nodes, edges, columns, minLane, maxLane };
}
