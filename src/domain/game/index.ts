export {
  BOOTSTRAP_ROOT_ID,
  createNodeId,
  resetNodeIdSequenceForTests,
} from "@/domain/game/id";
export {
  createChess,
  DEFAULT_POSITION,
  findKingOnChess,
  findKingSquare,
  getLegalMoves,
  getStatus,
  getStatusAlongPath,
  getTurn,
  isLegalMove,
  isValidFen,
  legalUciPrefix,
  lineUciToSan,
  moveToUci,
  parseUci,
  sanToUci,
  toGameMove,
  tryApplyMove,
  uciToSan,
  validateFen,
  validateLegalUci,
} from "@/domain/game/rules";
export {
  normalizeSessionForResume,
  sessionModeForTurn,
} from "@/domain/game/session";
export type { PlayMoveOnTreeOptions } from "@/domain/game/tree";
export {
  createBootstrapTree,
  createInitialTree,
  getAncestors,
  getCurrentNode,
  getMainlinePath,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  jumpToNode,
  listMainlineChild,
  playMoveOnTree,
  promoteVariation,
  pruneSubtree,
  pruneVariationChildren,
  takebackOne,
} from "@/domain/game/tree";
export type {
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
  createSessionState,
  DEFAULT_HUMAN_COLOR,
  isHumanTurn,
  opponentColor,
} from "@/domain/game/types";
export type { VariationExplorerState } from "@/domain/game/variation";
export {
  createVariationExplorer,
  exitVariationExplorer,
  stepVariationBack,
  stepVariationForward,
  tryInsteadFromExplorer,
  validateVariationLine,
} from "@/domain/game/variation";
