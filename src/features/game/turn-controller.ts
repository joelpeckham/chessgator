import {
  type Color,
  type GameTree,
  getCurrentNode,
  getStatusAtNode,
  getTurn,
  isHumanTurn,
  type SessionMode,
} from "@/domain/game";
import type {
  PracticePhase,
  TimelineUiMode,
} from "@/features/game/timeline-session";

export type OpponentScope = "live" | "practice";

export type OpponentTarget = {
  scope: OpponentScope;
  nodeId: string;
  fen: string;
};

export function opponentTargetKey(
  target: OpponentTarget | null,
): string | null {
  if (!target) return null;
  return `${target.scope}:${target.nodeId}`;
}

/**
 * Live opponent work pauses while practicing. Practice replies are a separate
 * target on the draft tree. Callers schedule Maia from this value.
 */
export function deriveOpponentTarget(args: {
  timelineMode: TimelineUiMode;
  practicePhase: PracticePhase | null;
  draftTree: GameTree | null;
  liveMode: SessionMode;
  liveTree: GameTree;
}): OpponentTarget | null {
  if (args.timelineMode === "practice") {
    if (args.practicePhase !== "opponentThinking" || !args.draftTree) {
      return null;
    }
    const node = getCurrentNode(args.draftTree);
    return { scope: "practice", nodeId: node.id, fen: node.fen };
  }
  if (args.liveMode !== "opponentThinking") return null;
  const node = getCurrentNode(args.liveTree);
  return { scope: "live", nodeId: node.id, fen: node.fen };
}

export function deriveBoardInteractivity(args: {
  timelineMode: TimelineUiMode;
  practicePhase: PracticePhase | null;
  draftTree: GameTree | null;
  playCursorId: string;
  liveMode: SessionMode;
  liveFen: string;
  humanColor: Color;
  isViewingNonLive: boolean;
  maiaFailed: boolean;
}): boolean {
  if (args.maiaFailed) return false;
  if (args.timelineMode === "practice") {
    if (args.practicePhase !== "playerTurn" || !args.draftTree) return false;
    if (args.playCursorId !== args.draftTree.currentNodeId) return false;
    const status = getStatusAtNode(
      args.draftTree,
      args.draftTree.currentNodeId,
    );
    if (status.isGameOver) return false;
    return isHumanTurn(getTurn(status.fen), args.humanColor);
  }
  return (
    args.liveMode === "playerTurn" &&
    isHumanTurn(getTurn(args.liveFen), args.humanColor) &&
    !args.isViewingNonLive
  );
}
