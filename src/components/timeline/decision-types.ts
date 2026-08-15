export type DecisionGraphNodeKind = "committed" | "tutor" | "projected";

export type DecisionGraphNode = {
  id: string;
  parentId: string | null;
  column: number;
  lane: number;
  kind: DecisionGraphNodeKind;
  san: string;
  moveLabel: string;
  caption: string | null;
  prominent: boolean;
  isCurrent: boolean;
  fen: string;
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
