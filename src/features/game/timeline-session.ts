import { PRACTICE_BRANCH_ID } from "@/components/timeline/decision-types";
import {
  type Color,
  type GameTree,
  getCurrentNode,
  getNode,
  getStatusAtNode,
  getTurn,
  isHumanTurn,
  jumpToNode,
  playMoveOnTree,
  takebackOne,
} from "@/domain/game";
import type { MoveInput } from "@/domain/game/types";

export type TimelineUiMode = "live" | "review" | "practice";

export type PracticePhase =
  | "playerTurn"
  | "opponentThinking"
  | "gameOver"
  | "error";

export type PracticeTurn = {
  humanUci: string;
  replyUci: string | null;
};

export type TimelineSessionState = {
  mode: TimelineUiMode;
  /** Review / graph cursor. Null follows the live tip. */
  focusNodeId: string | null;
  previewNodeId: string | null;
  /** Branch left/right stepping should follow. */
  pinnedBranchId: string | null;
  /** Decision whose local forks stay expanded while navigating. */
  expandedDecisionId: string | null;
  draftTree: GameTree | null;
  practiceOriginId: string | null;
  practicePhase: PracticePhase | null;
  practiceTurns: PracticeTurn[];
  practiceRedo: PracticeTurn[];
  practiceError: string | null;
};

export const INITIAL_TIMELINE_SESSION: TimelineSessionState = {
  mode: "live",
  focusNodeId: null,
  previewNodeId: null,
  pinnedBranchId: null,
  expandedDecisionId: null,
  draftTree: null,
  practiceOriginId: null,
  practicePhase: null,
  practiceTurns: [],
  practiceRedo: [],
  practiceError: null,
};

export type TimelineSessionAction =
  | {
      type: "selectNode";
      nodeId: string;
      liveId: string;
      pinnedBranchId?: string | null;
      expandedDecisionId?: string | null;
    }
  | { type: "returnLive" }
  | { type: "preview"; nodeId: string | null }
  | {
      type: "startPractice";
      originId: string;
      liveTree: GameTree;
      humanColor: Color;
      expandedDecisionId?: string | null;
    }
  | { type: "practiceMove"; input: MoveInput; humanColor: Color }
  | { type: "practiceOpponentMove"; input: MoveInput }
  | { type: "practiceJump"; nodeId: string }
  | { type: "practiceUndo" }
  | { type: "practiceRedo"; humanColor: Color }
  | { type: "practiceError"; message: string }
  | { type: "cancelPractice" }
  | { type: "reset" };

function cloneTree(tree: GameTree): GameTree {
  return {
    rootId: tree.rootId,
    currentNodeId: tree.currentNodeId,
    nodes: { ...tree.nodes },
  };
}

function phaseFromDraft(draft: GameTree, humanColor: Color): PracticePhase {
  const status = getStatusAtNode(draft, draft.currentNodeId);
  if (status.isGameOver) return "gameOver";
  return isHumanTurn(status.turn, humanColor)
    ? "playerTurn"
    : "opponentThinking";
}

function pinFromSelect(
  state: TimelineSessionState,
  action: Extract<TimelineSessionAction, { type: "selectNode" }>,
): Pick<TimelineSessionState, "pinnedBranchId" | "expandedDecisionId"> {
  return {
    pinnedBranchId:
      action.pinnedBranchId === undefined
        ? state.pinnedBranchId
        : action.pinnedBranchId,
    expandedDecisionId:
      action.expandedDecisionId === undefined
        ? state.expandedDecisionId
        : action.expandedDecisionId,
  };
}

export function reduceTimelineSession(
  state: TimelineSessionState,
  action: TimelineSessionAction,
): TimelineSessionState {
  switch (action.type) {
    case "selectNode": {
      const pin = pinFromSelect(state, action);
      if (state.mode === "practice" && state.draftTree) {
        return {
          ...state,
          ...pin,
          focusNodeId: action.nodeId,
          previewNodeId: null,
        };
      }
      if (action.nodeId === action.liveId) {
        return {
          ...state,
          ...pin,
          mode: "live",
          focusNodeId: null,
          previewNodeId: null,
        };
      }
      return {
        ...state,
        ...pin,
        mode: "review",
        focusNodeId: action.nodeId,
        previewNodeId: null,
      };
    }
    case "returnLive":
    case "cancelPractice":
    case "reset":
      return { ...INITIAL_TIMELINE_SESSION };
    case "preview":
      return { ...state, previewNodeId: action.nodeId };
    case "startPractice": {
      const jumped = jumpToNode(action.liveTree, action.originId);
      if (!jumped) return state;
      const draft = cloneTree(jumped);
      return {
        mode: "practice",
        focusNodeId: action.originId,
        previewNodeId: null,
        pinnedBranchId: PRACTICE_BRANCH_ID,
        expandedDecisionId:
          action.expandedDecisionId ?? state.expandedDecisionId,
        draftTree: draft,
        practiceOriginId: action.originId,
        practicePhase: phaseFromDraft(draft, action.humanColor),
        practiceTurns: [],
        practiceRedo: [],
        practiceError: null,
      };
    }
    case "practiceMove": {
      if (state.mode !== "practice" || !state.draftTree) return state;
      if (state.practicePhase !== "playerTurn") return state;
      const current = getCurrentNode(state.draftTree);
      if (getTurn(current.fen) !== action.humanColor) return state;
      const played = playMoveOnTree(
        state.draftTree,
        state.draftTree.currentNodeId,
        action.input,
        { asVariation: true },
      );
      if (!played) return state;
      const nextPhase = phaseFromDraft(played.tree, action.humanColor);
      const completeWithoutReply =
        nextPhase === "gameOver"
          ? {
              practiceTurns: [
                ...state.practiceTurns,
                { humanUci: played.node.move?.uci ?? "", replyUci: null },
              ],
            }
          : {};
      return {
        ...state,
        draftTree: played.tree,
        focusNodeId: played.node.id,
        practicePhase: nextPhase,
        practiceRedo: [],
        practiceError: null,
        ...completeWithoutReply,
      };
    }
    case "practiceOpponentMove": {
      if (state.mode !== "practice" || !state.draftTree) return state;
      if (state.practicePhase !== "opponentThinking") return state;
      const humanNode = getCurrentNode(state.draftTree);
      const played = playMoveOnTree(
        state.draftTree,
        state.draftTree.currentNodeId,
        action.input,
        { asVariation: true },
      );
      if (!played) {
        return {
          ...state,
          practicePhase: "error",
          practiceError: "Could not play Maia's practice reply",
        };
      }
      const humanUci = humanNode.move?.uci;
      const replyUci = played.node.move?.uci ?? null;
      const followTip = state.focusNodeId === humanNode.id;
      const status = getStatusAtNode(played.tree, played.tree.currentNodeId);
      return {
        ...state,
        draftTree: played.tree,
        focusNodeId: followTip ? played.node.id : state.focusNodeId,
        practicePhase: status.isGameOver ? "gameOver" : "playerTurn",
        practiceTurns:
          humanUci && replyUci
            ? [...state.practiceTurns, { humanUci, replyUci }]
            : state.practiceTurns,
        practiceError: null,
      };
    }
    case "practiceJump": {
      if (state.mode !== "practice" || !state.draftTree) return state;
      const jumped = jumpToNode(state.draftTree, action.nodeId);
      if (!jumped) return state;
      return {
        ...state,
        draftTree: jumped,
        focusNodeId: action.nodeId,
        previewNodeId: null,
      };
    }
    case "practiceUndo": {
      if (state.mode !== "practice" || !state.draftTree) return state;
      if (state.draftTree.currentNodeId === state.practiceOriginId) {
        return state;
      }
      if (state.practicePhase === "opponentThinking") {
        const next = takebackOne(state.draftTree);
        if (!next) return state;
        return {
          ...state,
          draftTree: next,
          focusNodeId: next.currentNodeId,
          practicePhase: "playerTurn",
          practiceError: null,
        };
      }
      const turn = state.practiceTurns[state.practiceTurns.length - 1];
      if (!turn) return state;
      let nextTree = state.draftTree;
      if (turn.replyUci) {
        const afterReply = takebackOne(nextTree);
        if (!afterReply) return state;
        nextTree = afterReply;
      }
      const afterHuman = takebackOne(nextTree);
      if (!afterHuman) return state;
      return {
        ...state,
        draftTree: afterHuman,
        focusNodeId: afterHuman.currentNodeId,
        practicePhase: "playerTurn",
        practiceTurns: state.practiceTurns.slice(0, -1),
        practiceRedo: [...state.practiceRedo, turn],
        practiceError: null,
      };
    }
    case "practiceRedo": {
      if (state.mode !== "practice" || !state.draftTree) return state;
      const turn = state.practiceRedo[state.practiceRedo.length - 1];
      if (!turn) return state;
      const human = playMoveOnTree(
        state.draftTree,
        state.draftTree.currentNodeId,
        turn.humanUci,
        { asVariation: true },
      );
      if (!human) return state;
      let draft = human.tree;
      let focusId = human.node.id;
      let phase: PracticePhase = "playerTurn";
      if (turn.replyUci) {
        const reply = playMoveOnTree(
          draft,
          draft.currentNodeId,
          turn.replyUci,
          {
            asVariation: true,
          },
        );
        if (!reply) return state;
        draft = reply.tree;
        focusId = reply.node.id;
        phase = phaseFromDraft(draft, action.humanColor);
      } else {
        phase = phaseFromDraft(draft, action.humanColor);
      }
      return {
        ...state,
        draftTree: draft,
        focusNodeId: focusId,
        practicePhase: phase,
        practiceTurns: [...state.practiceTurns, turn],
        practiceRedo: state.practiceRedo.slice(0, -1),
        practiceError: null,
      };
    }
    case "practiceError":
      if (state.mode !== "practice") return state;
      return {
        ...state,
        practicePhase: "error",
        practiceError: action.message,
      };
    default:
      return state;
  }
}

export function viewedNodeId(
  state: TimelineSessionState,
  liveId: string,
): string {
  if (state.previewNodeId) return state.previewNodeId;
  return graphCursorId(state, liveId);
}

/** Stable graph/keyboard cursor. Hover preview must not rebuild rails. */
export function graphCursorId(
  state: TimelineSessionState,
  liveId: string,
): string {
  if (state.mode === "practice") {
    return state.focusNodeId ?? state.draftTree?.currentNodeId ?? liveId;
  }
  return state.focusNodeId ?? liveId;
}

export function isReviewingNonLive(
  state: TimelineSessionState,
  liveId: string,
): boolean {
  if (state.mode === "practice") {
    const viewed = viewedNodeId(state, liveId);
    return viewed !== (state.draftTree?.currentNodeId ?? liveId);
  }
  const viewed = viewedNodeId(state, liveId);
  return viewed !== liveId;
}

export function firstDraftUci(
  draft: GameTree,
  originId: string,
): string | null {
  const chain: string[] = [];
  let cursor: string | null = draft.currentNodeId;
  const seen = new Set<string>();
  while (cursor && cursor !== originId && !seen.has(cursor)) {
    seen.add(cursor);
    const node = getNode(draft, cursor);
    if (!node?.move) break;
    chain.push(node.move.uci);
    cursor = node.parentId;
  }
  chain.reverse();
  return chain[0] ?? null;
}
