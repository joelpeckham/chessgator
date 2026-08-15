import { PRACTICE_BRANCH_ID } from "@/components/timeline/decision-types";
import {
  type Color,
  type GameTree,
  getCurrentNode,
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

export type PracticeDraft = {
  tree: GameTree;
  originId: string;
  phase: PracticePhase;
  turns: PracticeTurn[];
  redo: PracticeTurn[];
  error: string | null;
};

type TimelineBase = {
  /** Review / graph cursor. Null follows the live tip. */
  focusNodeId: string | null;
  previewNodeId: string | null;
  /** Branch left/right stepping should follow. */
  pinnedBranchId: string | null;
  /** Decision whose local forks stay expanded while navigating. */
  expandedDecisionId: string | null;
};

export type TimelineSessionState =
  | (TimelineBase & { mode: "live" | "review" })
  | (TimelineBase & { mode: "practice"; draft: PracticeDraft });

export const INITIAL_TIMELINE_SESSION: TimelineSessionState = {
  mode: "live",
  focusNodeId: null,
  previewNodeId: null,
  pinnedBranchId: null,
  expandedDecisionId: null,
};

export function practiceDraft(
  state: TimelineSessionState,
): PracticeDraft | null {
  return state.mode === "practice" ? state.draft : null;
}

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

function withDraft(
  state: Extract<TimelineSessionState, { mode: "practice" }>,
  draft: Partial<PracticeDraft>,
  rest?: Partial<TimelineBase>,
): TimelineSessionState {
  return {
    ...state,
    ...rest,
    draft: { ...state.draft, ...draft },
  };
}

export function reduceTimelineSession(
  state: TimelineSessionState,
  action: TimelineSessionAction,
): TimelineSessionState {
  switch (action.type) {
    case "selectNode": {
      const pin = pinFromSelect(state, action);
      if (state.mode === "practice") {
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
      const tree = cloneTree(jumped);
      return {
        mode: "practice",
        focusNodeId: action.originId,
        previewNodeId: null,
        pinnedBranchId: PRACTICE_BRANCH_ID,
        expandedDecisionId:
          action.expandedDecisionId ?? state.expandedDecisionId,
        draft: {
          tree,
          originId: action.originId,
          phase: phaseFromDraft(tree, action.humanColor),
          turns: [],
          redo: [],
          error: null,
        },
      };
    }
    case "practiceMove": {
      if (state.mode !== "practice") return state;
      if (state.draft.phase !== "playerTurn") return state;
      const current = getCurrentNode(state.draft.tree);
      if (getTurn(current.fen) !== action.humanColor) return state;
      const played = playMoveOnTree(
        state.draft.tree,
        state.draft.tree.currentNodeId,
        action.input,
        { asVariation: true },
      );
      if (!played) return state;
      const nextPhase = phaseFromDraft(played.tree, action.humanColor);
      return withDraft(
        state,
        {
          tree: played.tree,
          phase: nextPhase,
          redo: [],
          error: null,
          turns:
            nextPhase === "gameOver"
              ? [
                  ...state.draft.turns,
                  { humanUci: played.node.move?.uci ?? "", replyUci: null },
                ]
              : state.draft.turns,
        },
        { focusNodeId: played.node.id },
      );
    }
    case "practiceOpponentMove": {
      if (state.mode !== "practice") return state;
      if (state.draft.phase !== "opponentThinking") return state;
      const humanNode = getCurrentNode(state.draft.tree);
      const played = playMoveOnTree(
        state.draft.tree,
        state.draft.tree.currentNodeId,
        action.input,
        { asVariation: true },
      );
      if (!played) {
        return withDraft(state, {
          phase: "error",
          error: "Could not play Maia's practice reply",
        });
      }
      const humanUci = humanNode.move?.uci;
      const replyUci = played.node.move?.uci ?? null;
      const followTip = state.focusNodeId === humanNode.id;
      const status = getStatusAtNode(played.tree, played.tree.currentNodeId);
      return withDraft(
        state,
        {
          tree: played.tree,
          phase: status.isGameOver ? "gameOver" : "playerTurn",
          turns:
            humanUci && replyUci
              ? [...state.draft.turns, { humanUci, replyUci }]
              : state.draft.turns,
          error: null,
        },
        { focusNodeId: followTip ? played.node.id : state.focusNodeId },
      );
    }
    case "practiceUndo": {
      if (state.mode !== "practice") return state;
      if (state.draft.tree.currentNodeId === state.draft.originId) {
        return state;
      }
      if (state.draft.phase === "opponentThinking") {
        const next = takebackOne(state.draft.tree);
        if (!next) return state;
        return withDraft(
          state,
          { tree: next, phase: "playerTurn", error: null },
          { focusNodeId: next.currentNodeId },
        );
      }
      const turn = state.draft.turns[state.draft.turns.length - 1];
      if (!turn) return state;
      let nextTree = state.draft.tree;
      if (turn.replyUci) {
        const afterReply = takebackOne(nextTree);
        if (!afterReply) return state;
        nextTree = afterReply;
      }
      const afterHuman = takebackOne(nextTree);
      if (!afterHuman) return state;
      return withDraft(
        state,
        {
          tree: afterHuman,
          phase: "playerTurn",
          turns: state.draft.turns.slice(0, -1),
          redo: [...state.draft.redo, turn],
          error: null,
        },
        { focusNodeId: afterHuman.currentNodeId },
      );
    }
    case "practiceRedo": {
      if (state.mode !== "practice") return state;
      const turn = state.draft.redo[state.draft.redo.length - 1];
      if (!turn) return state;
      const human = playMoveOnTree(
        state.draft.tree,
        state.draft.tree.currentNodeId,
        turn.humanUci,
        { asVariation: true },
      );
      if (!human) return state;
      let tree = human.tree;
      let focusId = human.node.id;
      if (turn.replyUci) {
        const reply = playMoveOnTree(tree, tree.currentNodeId, turn.replyUci, {
          asVariation: true,
        });
        if (!reply) return state;
        tree = reply.tree;
        focusId = reply.node.id;
      }
      return withDraft(
        state,
        {
          tree,
          phase: phaseFromDraft(tree, action.humanColor),
          turns: [...state.draft.turns, turn],
          redo: state.draft.redo.slice(0, -1),
          error: null,
        },
        { focusNodeId: focusId },
      );
    }
    case "practiceError":
      if (state.mode !== "practice") return state;
      return withDraft(state, { phase: "error", error: action.message });
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
    return state.focusNodeId ?? state.draft.tree.currentNodeId;
  }
  return state.focusNodeId ?? liveId;
}

export function isReviewingNonLive(
  state: TimelineSessionState,
  liveId: string,
): boolean {
  if (state.mode === "practice") {
    const viewed = viewedNodeId(state, liveId);
    return viewed !== state.draft.tree.currentNodeId;
  }
  const viewed = viewedNodeId(state, liveId);
  return viewed !== liveId;
}
