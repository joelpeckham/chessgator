import type { Color, PieceSymbol, Square } from "chess.js";

export type { Color, PieceSymbol, Square };

/** Default side for a first visit / missing persisted color. */
export const DEFAULT_HUMAN_COLOR: Color = "w";

export function opponentColor(humanColor: Color): Color {
  return humanColor === "w" ? "b" : "w";
}

export function isHumanTurn(turn: Color, humanColor: Color): boolean {
  return turn === humanColor;
}

/** Input accepted by move-application helpers (object or UCI/SAN string). */
export type MoveInput =
  | string
  | {
      from: Square | string;
      to: Square | string;
      promotion?: PieceSymbol | string;
    };

/** Normalized move recorded on a tree node (the move that produced this position). */
export type GameMove = {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  san: string;
  uci: string;
  color: Color;
  piece: PieceSymbol;
  captured?: PieceSymbol;
};

export type GameStatusReason =
  | "ongoing"
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fiftyMove"
  | "insufficientMaterial"
  | "draw"
  | "resignation";

export type GameStatus = {
  fen: string;
  turn: Color;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isThreefoldRepetition: boolean;
  isInsufficientMaterial: boolean;
  isDrawByFiftyMoves: boolean;
  isGameOver: boolean;
  result: "ongoing" | "whiteWins" | "blackWins" | "draw";
  reason: GameStatusReason;
};

export type GameNode = {
  id: string;
  parentId: string | null;
  childIds: readonly string[];
  fen: string;
  /** Move that led to this node; null for the root. */
  move: GameMove | null;
  ply: number;
  /**
   * Ghost / exploration line (e.g. Variation Explorer).
   * Not part of the committed main line unless promoted via "Try instead".
   */
  isVariation: boolean;
  /** Set when the node is created; undefined on reconstructed snapshots. */
  threefold?: boolean;
};

export type GameTree = {
  nodes: Readonly<Record<string, GameNode>>;
  rootId: string;
  currentNodeId: string;
};

/**
 * Session mode is orthogonal to the tree pointer (`currentNodeId`).
 * The pointer answers where on the live tree we are; the mode answers what
 * play/engine work may do. Timeline scrub is an ephemeral UI cursor and does
 * not change `currentNodeId` or this mode.
 *
 * `"reviewing"` is only the hydrate transient: a restored in-progress game
 * sits here until `resumePlay` maps it to playerTurn / opponentThinking.
 */
export type SessionMode =
  | "loading"
  | "playerTurn"
  | "opponentThinking"
  | "analyzing"
  | "reviewing"
  | "gameOver"
  | "error";

export type SessionState = {
  mode: SessionMode;
  /** Optional override when the game ended by resignation rather than rules. */
  terminalReason: GameStatusReason | null;
};

export type GameSession = {
  tree: GameTree;
  session: SessionState;
};

export function createSessionState(
  mode: SessionMode = "loading",
): SessionState {
  return {
    mode,
    terminalReason: null,
  };
}
