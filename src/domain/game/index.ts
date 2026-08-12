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

export { createSessionState } from "@/domain/game/types";

export {
  BOOTSTRAP_ROOT_ID,
  createNodeId,
  resetNodeIdSequenceForTests,
} from "@/domain/game/id";

export {
  DEFAULT_POSITION,
  createChess,
  getLegalMoves,
  getStatus,
  getStatusAlongPath,
  getTurn,
  isLegalMove,
  isValidFen,
  legalUciPrefix,
  moveToUci,
  parseUci,
  replayMoves,
  sanToUci,
  toGameMove,
  tryApplyMove,
  uciToSan,
  validateFen,
  validateLegalUci,
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
  playMoveOnTree,
  promoteVariation,
  pruneSubtree,
  pruneVariationChildren,
  takebackOne,
} from "@/domain/game/tree";
export type { PlayMoveOnTreeOptions } from "@/domain/game/tree";

export {
  createVariationExplorer,
  exitVariationExplorer,
  stepVariationBack,
  stepVariationForward,
  tryInsteadFromExplorer,
  validateVariationLine,
} from "@/domain/game/variation";
export type { VariationExplorerState } from "@/domain/game/variation";
