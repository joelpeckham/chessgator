export type {
  AnalysisSummary,
  Color,
  GameMove,
  GameNode,
  GameSession,
  GameStatus,
  GameStatusReason,
  GameTree,
  MoveInput,
  PieceSymbol,
  SessionMode,
  SessionState,
  Square,
} from "@/domain/game/types";

export {
  BOOTSTRAP_ROOT_ID,
  createNodeId,
  resetNodeIdSequenceForTests,
} from "@/domain/game/id";

export {
  DEFAULT_POSITION,
  createChess,
  getFen,
  getLegalMoves,
  getStatus,
  getStatusAlongPath,
  getTurn,
  isLegalMove,
  isValidFen,
  moveToSan,
  moveToUci,
  parseUci,
  replayMoves,
  sanToUci,
  toGameMove,
  tryApplyMove,
  uciToSan,
  validateFen,
} from "@/domain/game/rules";

export {
  createBootstrapTree,
  createInitialTree,
  getAncestors,
  getCurrentNode,
  getMainlinePath,
  getMoveHistory,
  getNode,
  getPathFenHistory,
  getStatusAtNode,
  jumpToNode,
  listMainlineChild,
  listVariationChildren,
  playMoveOnTree,
  promoteVariation,
  pruneSubtree,
  pruneVariationChildren,
  setNodeAnalysis,
  takebackOne,
} from "@/domain/game/tree";
export type { PlayMoveOnTreeOptions } from "@/domain/game/tree";

export {
  createVariationExplorer,
  discardVariationRoot,
  exitVariationExplorer,
  jumpVariationStep,
  stepVariationBack,
  stepVariationForward,
  tryInsteadFromExplorer,
  validateVariationLine,
  variationOverlayNodes,
} from "@/domain/game/variation";
export type { VariationExplorerState } from "@/domain/game/variation";

export {
  SESSION_TRANSITIONS,
  canTransition,
  createSessionState,
  enterError,
  listTransitions,
  transitionSession,
} from "@/domain/game/session";

export type { CommandResult } from "@/domain/game/commands";
export {
  createGameSession,
  currentFen,
  currentStatus,
  jumpToGameNode,
  playMove,
  resign,
  retryMove,
  setSessionMode,
  startGame,
  takeback,
} from "@/domain/game/commands";
