import type { Color } from "@/domain/game";

export type DecisionGraphNodeKind = "committed" | "suggested";

export type DecisionGraphNode = {
  id: string;
  parentId: string | null;
  column: number;
  lane: number;
  kind: DecisionGraphNodeKind;
  san: string;
  moveLabel: string;
  caption: string | null;
  isCurrent: boolean;
  fen: string;
  /** Move that reached this node; null for the root. */
  uci: string | null;
  /** Side that made this move; null for the root. */
  moveColor: Color | null;
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
  minLane: number;
  maxLane: number;
};
