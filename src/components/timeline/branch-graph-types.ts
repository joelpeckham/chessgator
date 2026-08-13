import type { ProjectedLine } from "@/domain/analysis/projected-lines";
import type { Color, GameTree } from "@/domain/game";

export type TimelineNodeKind =
  | "committed"
  | "variation"
  | "projected"
  | "tutor";

export type TimelineLaneRole =
  | "played"
  | "coach"
  | "engine"
  | "variationA"
  | "variationB"
  | "overflow";

export type TimelineGraphNode = {
  id: string;
  parentId: string | null;
  fen: string;
  san: string | null;
  /** Numbered SAN label, e.g. "1.e4", "8…d5", or "start". */
  moveLabel: string;
  ply: number;
  kind: TimelineNodeKind;
  laneRole: TimelineLaneRole;
  /** Stable branch identity: `played:…`, `var:parent:uci`, `tutor:…`, `projected:…`. */
  branchKey: string;
  /** 0 = current game; +1 coach; −1 engine; ±2 variations. */
  lane: number;
  column: number;
  /** Matches the live game playhead (`tree.currentNodeId`). */
  isLive: boolean;
  /** Matches the ephemeral review cursor. */
  isReview: boolean;
  isOnPlayedPath: boolean;
  isOnReviewPath: boolean;
  /**
   * For projected/tutor nodes: the committed tree node the line branches from.
   * For committed/variation: the tree node id (same as `id`).
   */
  sourceNodeId: string;
  uciFromParent: string | null;
  /** True when this node is a collapsed "+N" overflow sentinel. */
  isOverflow?: boolean;
  overflowCount?: number;
  overflowGroupId?: string;
  /** True when a side branch hit the forward ply cap. */
  isTruncated?: boolean;
};

export type TimelineGraphEdge = {
  fromId: string;
  toId: string;
  kind: TimelineNodeKind;
};

export type TimelineOverflowBranch = {
  branchKey: string;
  headNodeId: string;
  san: string;
  uci: string;
  moveLabel: string;
  fen: string;
  ply: number;
  length: number;
};

export type TimelineOverflowGroup = {
  id: string;
  parentId: string;
  column: number;
  hiddenBranches: TimelineOverflowBranch[];
};

export type TimelineGraph = {
  nodes: TimelineGraphNode[];
  edges: TimelineGraphEdge[];
  /** Max absolute lane used (for vertical sizing). */
  maxLaneAbs: number;
  columns: number;
  currentGamePath: readonly string[];
  reviewPath: readonly string[];
  liveTipColumn: number;
  overflowGroups: TimelineOverflowGroup[];
};

export type BuildBranchGraphInput = {
  tree: GameTree;
  /** Ephemeral review cursor; null follows the live playhead. */
  reviewNodeId?: string | null;
  /** Best-play future from the live tip. */
  futureLine?: ProjectedLine | null;
  /** Coach alternate line (e.g. improvement from before the last move). */
  tutorLine?: ProjectedLine | null;
  /**
   * Branch keys the user has pinned from overflow menus.
   * Format: `var:${parentId}:${uci}`.
   */
  expandedOverflowKeys?: readonly string[];
  /**
   * Max absolute side lane for variations.
   * Desktop: 2 (±2 variation slots). Mobile: 1 (no variation slots; overflow sooner).
   */
  maxLaneSide?: number;
  /**
   * When false, suppress the engine future line (e.g. during review or when
   * coach context should take the secondary slot on mobile).
   */
  showEngineLine?: boolean;
  /**
   * When false, suppress the coach projected line.
   */
  showCoachLine?: boolean;
  /** Human's playing side; engine futures are shown only on this side to move. */
  humanColor?: Color;
};

export const LANE = {
  played: 0,
  coach: 1,
  engine: -1,
  variationA: 2,
  variationB: -2,
} as const;
