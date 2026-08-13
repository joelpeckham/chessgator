import type { MoveClassification } from "@/domain/analysis/classification";
import type { GameTree } from "@/domain/game";

export type SavedTryView = {
  nodeId: string;
  san: string;
  moveLabel: string;
  fen: string;
  ply: number;
  length: number;
};

export type PlayerDecisionView = {
  id: string;
  originNodeId: string;
  humanNodeId: string;
  replyNodeId: string | null;
  moveLabel: string;
  san: string;
  ply: number;
  prominent: boolean;
  classification: MoveClassification | null;
  savedTries: SavedTryView[];
};

export type LessonForkPly = {
  id: string;
  label: string;
  san: string;
  fen: string;
};

export type LessonForkView = {
  originNodeId: string;
  played: LessonForkPly;
  suggested: {
    head: LessonForkPly;
    plies: LessonForkPly[];
  } | null;
};

export type EngineHintView = {
  id: string;
  san: string;
  fen: string;
};

/** Opponent plies before the first human decision (Black games). */
export type OpeningPlyView = {
  id: string;
  san: string;
  moveLabel: string;
  fen: string;
};

export type DecisionGraphNodeKind =
  | "committed"
  | "tutor"
  | "variation"
  | "practice"
  | "projected"
  | "overflow";

export type DecisionGraphLane = -1 | 0 | 1;

export type DecisionGraphNode = {
  id: string;
  parentId: string | null;
  column: number;
  lane: DecisionGraphLane;
  kind: DecisionGraphNodeKind;
  san: string;
  moveLabel: string;
  caption: string | null;
  prominent: boolean;
  isLive: boolean;
  isDecision: boolean;
  fen: string;
  branchId: string;
  decisionId: string | null;
  overflowCount?: number;
  overflowTries?: SavedTryView[];
};

export type DecisionGraphEdge = {
  fromId: string;
  toId: string;
  kind: DecisionGraphNodeKind;
};

export type DecisionGraph = {
  nodes: DecisionGraphNode[];
  edges: DecisionGraphEdge[];
  columns: number;
};

export type PracticeOverlay = {
  originId: string;
  draftTree: GameTree;
  currentId: string;
};

export const LIVE_BRANCH_ID = "live";
export const PRACTICE_BRANCH_ID = "practice";
export const PROJECTED_BRANCH_ID = "projected";

export function tutorBranchId(originId: string): string {
  return `tutor:${originId}`;
}

export function tryBranchId(nodeId: string): string {
  return `try:${nodeId}`;
}
