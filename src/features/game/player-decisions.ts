import type {
  DecisionGraph,
  DecisionGraphEdge,
  DecisionGraphLane,
  DecisionGraphNode,
  DecisionGraphNodeKind,
  EngineHintView,
  LessonForkPly,
  LessonForkView,
  OpeningPlyView,
  PlayerDecisionView,
  PracticeOverlay,
  SavedTryView,
} from "@/components/timeline/decision-types";
import {
  LIVE_BRANCH_ID,
  PRACTICE_BRANCH_ID,
  PROJECTED_BRANCH_ID,
  tryBranchId,
  tutorBranchId,
} from "@/components/timeline/decision-types";
import type { ProjectedLine } from "@/domain/analysis";
import {
  type Color,
  type GameNode,
  type GameTree,
  getAncestors,
  getNode,
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import { isProminentLesson } from "@/features/game/learning-moments";

export type {
  DecisionGraph,
  DecisionGraphEdge,
  DecisionGraphLane,
  DecisionGraphNode,
  DecisionGraphNodeKind,
  EngineHintView,
  LessonForkPly,
  LessonForkView,
  OpeningPlyView,
  PlayerDecisionView,
  PracticeOverlay,
  SavedTryView,
} from "@/components/timeline/decision-types";

export {
  LIVE_BRANCH_ID,
  PRACTICE_BRANCH_ID,
  PROJECTED_BRANCH_ID,
  tryBranchId,
  tutorBranchId,
} from "@/components/timeline/decision-types";

const BRANCH_FORWARD_PLIES = 8;

export function formatMoveLabel(ply: number, san: string | null): string {
  if (!san) return "start";
  const moveNumber = Math.floor((ply + 1) / 2);
  if (ply % 2 === 1) return `${moveNumber}.${san}`;
  return `${moveNumber}…${san}`;
}

function livePath(tree: GameTree): GameNode[] {
  return getAncestors(tree, tree.currentNodeId);
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

function savedTriesAt(
  tree: GameTree,
  origin: GameNode,
  humanNodeId: string,
): SavedTryView[] {
  const tries: SavedTryView[] = [];
  for (const childId of origin.childIds) {
    if (childId === humanNodeId) continue;
    const child = tree.nodes[childId];
    if (!child?.move) continue;
    tries.push({
      nodeId: child.id,
      san: child.move.san,
      moveLabel: formatMoveLabel(child.ply, child.move.san),
      fen: child.fen,
      ply: child.ply,
      length: countBranchLength(tree, child),
    });
  }
  return tries;
}

/**
 * Group the live path into player decisions: each human ply plus the optional
 * opponent reply that followed it.
 */
export function projectPlayerDecisions(args: {
  tree: GameTree;
  humanColor: Color;
  lessons: Readonly<Record<string, TeachingInsight>>;
}): PlayerDecisionView[] {
  const path = livePath(args.tree);
  const decisions: PlayerDecisionView[] = [];

  for (let i = 1; i < path.length; i += 1) {
    const node = path[i]!;
    if (node.move?.color !== args.humanColor) continue;
    const originId = node.parentId ?? args.tree.rootId;
    const origin = getNode(args.tree, originId);
    const reply = path[i + 1];
    const replyNode =
      reply?.move && reply.move.color !== args.humanColor ? reply : null;
    const lesson = args.lessons[node.id] ?? null;
    decisions.push({
      id: node.id,
      originNodeId: originId,
      humanNodeId: node.id,
      replyNodeId: replyNode?.id ?? null,
      moveLabel: formatMoveLabel(node.ply, node.move.san),
      san: node.move.san,
      ply: node.ply,
      prominent: lesson ? isProminentLesson(lesson) : false,
      classification: lesson?.classification ?? null,
      savedTries: origin ? savedTriesAt(args.tree, origin, node.id) : [],
    });
  }

  return decisions;
}

/** Maia's opening plies when the human plays Black — context, not decisions. */
export function projectOpeningPlies(
  tree: GameTree,
  humanColor: Color,
): OpeningPlyView[] {
  const path = livePath(tree);
  const plies: OpeningPlyView[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const node = path[i]!;
    if (!node.move) break;
    if (node.move.color === humanColor) break;
    plies.push({
      id: node.id,
      san: node.move.san,
      moveLabel: formatMoveLabel(node.ply, node.move.san),
      fen: node.fen,
    });
  }
  return plies;
}

/**
 * Coach alternate at this origin, only when it differs from the live human ply.
 */
export function suggestedAlternateUci(args: {
  tree: GameTree;
  originId: string;
  humanColor: Color;
  lessons: Readonly<Record<string, TeachingInsight>>;
}): string | null {
  const origin = getNode(args.tree, args.originId);
  if (!origin) return null;
  for (const childId of origin.childIds) {
    const child = getNode(args.tree, childId);
    if (child?.move?.color !== args.humanColor) continue;
    const suggested = args.lessons[child.id]?.suggestedMoveUci;
    if (suggested && suggested.toLowerCase() !== child.move.uci.toLowerCase()) {
      return suggested;
    }
  }
  return null;
}

export function lastHumanDecisionId(
  tree: GameTree,
  humanColor: Color,
): string | null {
  const path = livePath(tree);
  for (let i = path.length - 1; i >= 1; i -= 1) {
    const node = path[i]!;
    if (node.move?.color === humanColor) return node.id;
  }
  return null;
}

export function analyzedNodeIdForFocus(args: {
  tree: GameTree;
  focusNodeId: string | null;
  tutorRootId: string | null;
  humanColor: Color;
}): string | null {
  const { tree, focusNodeId, tutorRootId, humanColor } = args;
  if (tutorRootId) {
    const origin = getNode(tree, tutorRootId);
    if (origin) {
      for (const childId of origin.childIds) {
        const child = tree.nodes[childId];
        if (child?.move?.color === humanColor) return child.id;
      }
    }
  }
  if (!focusNodeId) return lastHumanDecisionId(tree, humanColor);
  const node = getNode(tree, focusNodeId);
  if (!node) return lastHumanDecisionId(tree, humanColor);
  if (!node.move) return null;
  if (node.move.color === humanColor) return node.id;
  if (node.parentId) {
    const parent = getNode(tree, node.parentId);
    if (parent?.move?.color === humanColor) return parent.id;
  }
  return null;
}

export function decisionForCursor(args: {
  liveDecisions: readonly PlayerDecisionView[];
  cursorId: string;
  liveTree: GameTree;
  humanColor: Color;
  tutorRootId: string | null;
  practiceOriginId: string | null;
  expandedDecisionId: string | null;
}): PlayerDecisionView | null {
  const byId = new Map(args.liveDecisions.map((d) => [d.id, d]));
  if (args.expandedDecisionId) {
    const expanded = byId.get(args.expandedDecisionId);
    if (expanded) return expanded;
  }
  const analyzedId = analyzedNodeIdForFocus({
    tree: args.liveTree,
    focusNodeId: args.cursorId,
    tutorRootId: args.tutorRootId ?? args.practiceOriginId,
    humanColor: args.humanColor,
  });
  if (analyzedId) {
    const exact = byId.get(analyzedId);
    if (exact) return exact;
    const analyzed = getNode(args.liveTree, analyzedId);
    const originId = analyzed?.parentId ?? args.practiceOriginId;
    if (originId) {
      const byOrigin = args.liveDecisions.find(
        (d) => d.originNodeId === originId,
      );
      if (byOrigin) return byOrigin;
    }
  }
  if (args.practiceOriginId) {
    const byOrigin = args.liveDecisions.find(
      (d) => d.originNodeId === args.practiceOriginId,
    );
    if (byOrigin) return byOrigin;
  }
  return null;
}

export function buildLessonFork(args: {
  tree: GameTree;
  decision: PlayerDecisionView;
  tutorLine: ProjectedLine | null;
  virtualId: (kind: "tutor", rootId: string, pathKey: string) => string;
}): LessonForkView {
  const played = getNode(args.tree, args.decision.humanNodeId);
  const fork: LessonForkView = {
    originNodeId: args.decision.originNodeId,
    played: {
      id: args.decision.humanNodeId,
      label: args.decision.moveLabel,
      san: args.decision.san,
      fen: played?.fen ?? "",
    },
    suggested: null,
  };
  const line = args.tutorLine;
  if (!line || line.plies.length === 0) return fork;
  const plies: LessonForkPly[] = line.plies.map((ply) => ({
    id: args.virtualId("tutor", line.rootNodeId, ply.pathKey),
    label: formatMoveLabel(
      (played?.ply ?? line.plies[0]!.plyOffset) - 1 + ply.plyOffset,
      ply.san,
    ),
    san: ply.san,
    fen: ply.fen,
  }));
  const head = plies[0];
  if (!head) return fork;
  fork.suggested = { head, plies };
  return fork;
}

const MAX_TUTOR_PLIES = 3;
const MAX_TRY_PLIES = 2;

type TrunkPly = {
  id: string;
  parentId: string | null;
  san: string;
  moveLabel: string;
  fen: string;
  isDecision: boolean;
  prominent: boolean;
};

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
  if (edges.some((edge) => edge.fromId === fromId && edge.toId === toId))
    return;
  edges.push({ fromId, toId, kind });
}

function tryForwardPlies(
  tree: GameTree,
  head: SavedTryView,
  throughId?: string | null,
): Array<{ id: string; san: string; moveLabel: string; fen: string }> {
  const plies = [
    {
      id: head.nodeId,
      san: head.san,
      moveLabel: head.moveLabel,
      fen: head.fen,
    },
  ];
  let current = getNode(tree, head.nodeId);
  const seen = new Set<string>([head.nodeId]);
  const cap = throughId ? BRANCH_FORWARD_PLIES : MAX_TRY_PLIES;
  while (current && plies.length < cap) {
    const nextId = current.childIds[0];
    if (!nextId || seen.has(nextId)) break;
    seen.add(nextId);
    const next = getNode(tree, nextId);
    if (!next?.move) break;
    plies.push({
      id: next.id,
      san: next.move.san,
      moveLabel: formatMoveLabel(next.ply, next.move.san),
      fen: next.fen,
    });
    current = next;
    if (throughId && next.id === throughId) break;
  }
  return plies;
}

function includeThrough<T extends { id: string }>(
  plies: readonly T[],
  cursorId: string | null,
  cap: number,
): T[] {
  if (!cursorId) return plies.slice(0, cap);
  const idx = plies.findIndex((ply) => ply.id === cursorId);
  if (idx < 0) return plies.slice(0, cap);
  return plies.slice(0, Math.max(cap, idx + 1));
}

function pinnedTryId(pinnedBranchId: string | null): string | null {
  if (!pinnedBranchId?.startsWith("try:")) return null;
  return pinnedBranchId.slice("try:".length);
}

/**
 * Compact git graph: live-path trunk plus local forks at the focused decision.
 * The selected branch stays visible through the cursor.
 */
export function buildDecisionGraph(args: {
  tree: GameTree;
  startNodeId: string;
  tipNodeId: string;
  openingPlies: readonly OpeningPlyView[];
  decisions: readonly PlayerDecisionView[];
  focusedDecision: PlayerDecisionView | null;
  lessonFork: LessonForkView | null;
  engineHint: EngineHintView | null;
  cursorId?: string | null;
  pinnedBranchId?: string | null;
  practice?: PracticeOverlay | null;
}): DecisionGraph {
  const nodes: DecisionGraphNode[] = [];
  const edges: DecisionGraphEdge[] = [];
  const cursorId = args.cursorId ?? null;
  const startFen = getNode(args.tree, args.startNodeId)?.fen ?? "";
  const trunk: TrunkPly[] = [
    {
      id: args.startNodeId,
      parentId: null,
      san: "",
      moveLabel: "start",
      fen: startFen,
      isDecision: false,
      prominent: false,
    },
  ];
  let prevId = args.startNodeId;
  for (const ply of args.openingPlies) {
    trunk.push({
      id: ply.id,
      parentId: prevId,
      san: ply.san,
      moveLabel: ply.moveLabel,
      fen: ply.fen,
      isDecision: false,
      prominent: false,
    });
    prevId = ply.id;
  }
  for (const decision of args.decisions) {
    const human = getNode(args.tree, decision.humanNodeId);
    trunk.push({
      id: decision.humanNodeId,
      parentId: prevId,
      san: decision.san,
      moveLabel: decision.moveLabel,
      fen: human?.fen ?? "",
      isDecision: true,
      prominent: decision.prominent,
    });
    prevId = decision.humanNodeId;
    if (decision.replyNodeId) {
      const reply = getNode(args.tree, decision.replyNodeId);
      trunk.push({
        id: decision.replyNodeId,
        parentId: prevId,
        san: reply?.move?.san ?? "",
        moveLabel: formatMoveLabel(
          reply?.ply ?? decision.ply + 1,
          reply?.move?.san ?? null,
        ),
        fen: reply?.fen ?? "",
        isDecision: false,
        prominent: false,
      });
      prevId = decision.replyNodeId;
    }
  }

  const columnById = new Map<string, number>();
  for (const [column, ply] of trunk.entries()) {
    columnById.set(ply.id, column);
    const focusedHuman =
      args.focusedDecision?.humanNodeId === ply.id
        ? args.focusedDecision
        : null;
    pushNode(nodes, {
      id: ply.id,
      parentId: ply.parentId,
      column,
      lane: 0,
      kind: "committed",
      san: ply.san,
      moveLabel: ply.moveLabel,
      caption: focusedHuman ? "Current" : null,
      prominent: ply.prominent,
      isLive: ply.id === args.tipNodeId,
      isDecision: ply.isDecision,
      fen: ply.fen,
      branchId: LIVE_BRANCH_ID,
      decisionId: focusedHuman?.id ?? (ply.isDecision ? ply.id : null),
    });
    if (ply.parentId) {
      pushEdge(edges, ply.parentId, ply.id, "committed");
    }
  }

  if (args.engineHint) {
    const column = trunk.length;
    pushNode(nodes, {
      id: args.engineHint.id,
      parentId: prevId,
      column,
      lane: 0,
      kind: "projected",
      san: args.engineHint.san,
      moveLabel: args.engineHint.san,
      caption: null,
      prominent: false,
      isLive: false,
      isDecision: false,
      fen: args.engineHint.fen,
      branchId: PROJECTED_BRANCH_ID,
      decisionId: args.focusedDecision?.id ?? null,
    });
    pushEdge(edges, prevId, args.engineHint.id, "projected");
  }

  const focused = args.focusedDecision;
  const originColumn = focused
    ? columnById.get(focused.originNodeId)
    : undefined;
  const practicing = Boolean(args.practice);
  if (focused && originColumn != null) {
    const forkColumn = originColumn + 1;
    const tutorPlies = includeThrough(
      args.lessonFork?.suggested?.plies ?? [],
      cursorId,
      MAX_TUTOR_PLIES,
    );
    const showTutor = !practicing && tutorPlies.length > 0;
    const pinnedTry = pinnedTryId(args.pinnedBranchId ?? null);
    const maxVisibleTries = showTutor || practicing ? 1 : 2;
    const visibleTries = focused.savedTries.slice(0, maxVisibleTries);
    if (
      pinnedTry &&
      !visibleTries.some((tryView) => tryView.nodeId === pinnedTry)
    ) {
      const pinned = focused.savedTries.find(
        (tryView) => tryView.nodeId === pinnedTry,
      );
      if (pinned) {
        if (visibleTries.length >= maxVisibleTries) {
          visibleTries[visibleTries.length - 1] = pinned;
        } else {
          visibleTries.push(pinned);
        }
      }
    }
    const overflowTries = focused.savedTries.filter(
      (tryView) =>
        !visibleTries.some((visible) => visible.nodeId === tryView.nodeId),
    );
    const tryPlyCap = overflowTries.length > 0 ? 1 : MAX_TRY_PLIES;

    if (showTutor) {
      let tutorParent = focused.originNodeId;
      for (const [index, ply] of tutorPlies.entries()) {
        pushNode(nodes, {
          id: ply.id,
          parentId: tutorParent,
          column: forkColumn + index,
          lane: 1,
          kind: "tutor",
          san: ply.san,
          moveLabel: ply.label,
          caption: index === 0 ? "Gator" : null,
          prominent: false,
          isLive: false,
          isDecision: false,
          fen: ply.fen,
          branchId: tutorBranchId(focused.originNodeId),
          decisionId: focused.id,
        });
        pushEdge(edges, tutorParent, ply.id, "tutor");
        tutorParent = ply.id;
      }
    }

    const tryLanes: DecisionGraphLane[] =
      showTutor || practicing ? [-1] : [1, -1];
    for (const [index, tryView] of visibleTries.entries()) {
      const lane = tryLanes[index] ?? -1;
      const through =
        cursorId &&
        (cursorId === tryView.nodeId ||
          args.pinnedBranchId === tryBranchId(tryView.nodeId))
          ? cursorId
          : null;
      const rail = tryForwardPlies(args.tree, tryView, through).slice(
        0,
        through ? BRANCH_FORWARD_PLIES : tryPlyCap,
      );
      let tryParent = focused.originNodeId;
      for (const [plyIndex, ply] of rail.entries()) {
        pushNode(nodes, {
          id: ply.id,
          parentId: tryParent,
          column: forkColumn + plyIndex,
          lane,
          kind: "variation",
          san: ply.san,
          moveLabel: ply.moveLabel,
          caption: plyIndex === 0 ? "Saved" : null,
          prominent: false,
          isLive: ply.id === args.tipNodeId,
          isDecision: false,
          fen: ply.fen,
          branchId: tryBranchId(tryView.nodeId),
          decisionId: focused.id,
        });
        pushEdge(edges, tryParent, ply.id, "variation");
        tryParent = ply.id;
      }
    }

    if (overflowTries.length > 0) {
      const overflowLane: DecisionGraphLane =
        showTutor || practicing || visibleTries.length > 1 ? -1 : 1;
      const overflowColumn =
        visibleTries.length > 0 ? forkColumn + 1 : forkColumn;
      const overflowId = `overflow:${focused.id}`;
      pushNode(nodes, {
        id: overflowId,
        parentId: focused.originNodeId,
        column: overflowColumn,
        lane: overflowLane,
        kind: "overflow",
        san: `+${overflowTries.length}`,
        moveLabel: `${overflowTries.length} more tries`,
        caption: null,
        prominent: false,
        isLive: false,
        isDecision: false,
        fen: getNode(args.tree, focused.originNodeId)?.fen ?? "",
        branchId: tryBranchId(overflowTries[0]!.nodeId),
        decisionId: focused.id,
        overflowCount: overflowTries.length,
        overflowTries,
      });
      pushEdge(edges, focused.originNodeId, overflowId, "overflow");
    }
  }

  if (args.practice) {
    const practiceColumn = columnById.get(args.practice.originId);
    if (practiceColumn != null) {
      const forkColumn = practiceColumn + 1;
      const origin = getNode(args.practice.draftTree, args.practice.originId);
      const path = getAncestors(
        args.practice.draftTree,
        args.practice.currentId,
      ).filter((node) => node.ply > (origin?.ply ?? 0));
      let parentId = args.practice.originId;
      for (const [index, node] of path.entries()) {
        if (!node.move) continue;
        pushNode(nodes, {
          id: node.id,
          parentId,
          column: forkColumn + index,
          lane: 1,
          kind: "practice",
          san: node.move.san,
          moveLabel: formatMoveLabel(node.ply, node.move.san),
          caption: index === 0 ? "Practice" : null,
          prominent: false,
          isLive: false,
          isDecision: false,
          fen: node.fen,
          branchId: PRACTICE_BRANCH_ID,
          decisionId: focused?.id ?? null,
        });
        pushEdge(edges, parentId, node.id, "practice");
        parentId = node.id;
      }
    }
  }

  const lastColumn = nodes.reduce((max, node) => Math.max(max, node.column), 0);
  return { nodes, edges, columns: lastColumn + 1 };
}

export function graphHasCursor(
  graph: DecisionGraph,
  cursorId: string,
): boolean {
  return graph.nodes.some(
    (node) => node.id === cursorId && node.kind !== "overflow",
  );
}
