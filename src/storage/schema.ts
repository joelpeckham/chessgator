import type { AnalysisSummary } from "@/domain/analysis/types";
import { isValidFen, tryApplyMove } from "@/domain/game/rules";
import type {
  Color,
  GameMove,
  GameNode,
  GameSession,
  GameTree,
  PieceSymbol,
  SessionMode,
  Square,
} from "@/domain/game/types";

/** Bump when the on-disk shape changes; add a migrator in migrate.ts. */
export const GAME_SCHEMA_VERSION = 1 as const;

export type PersistedGameV1 = {
  version: 1;
  updatedAt: string;
  tree: {
    rootId: string;
    currentNodeId: string;
    nodes: Record<string, PersistedNodeV1>;
  };
  session: {
    mode: SessionMode;
    errorMessage: string | null;
    terminalReason:
      | "ongoing"
      | "checkmate"
      | "stalemate"
      | "threefold"
      | "fiftyMove"
      | "insufficientMaterial"
      | "draw"
      | "resignation"
      | null;
  };
  preferences?: {
    maiaElo?: number;
    playerColor?: Color;
  };
};

export type PersistedNodeV1 = {
  id: string;
  parentId: string | null;
  childIds: string[];
  fen: string;
  move: PersistedMoveV1 | null;
  ply: number;
  analysis: AnalysisSummary | null;
  /** Optional in older snapshots; missing means false. */
  isVariation?: boolean;
};

export type PersistedMoveV1 = {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  san: string;
  uci: string;
  color: Color;
  piece: PieceSymbol;
  captured?: PieceSymbol;
};

export type PersistedGame = PersistedGameV1;

const SESSION_MODES: ReadonlySet<SessionMode> = new Set([
  "loading",
  "playerTurn",
  "opponentThinking",
  "analyzing",
  "reviewing",
  "gameOver",
  "error",
]);

const COLORS: ReadonlySet<string> = new Set(["w", "b"]);
const PIECES: ReadonlySet<string> = new Set(["p", "n", "b", "r", "q", "k"]);
const SQUARE_RE = /^[a-h][1-8]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseAnalysis(value: unknown): AnalysisSummary | null | undefined {
  if (value === null) return null;
  if (value === undefined) return null;
  if (!isRecord(value)) return undefined;

  const summary: AnalysisSummary = {};
  if ("evalCp" in value) {
    if (!isFiniteNumber(value.evalCp)) return undefined;
    summary.evalCp = value.evalCp;
  }
  if ("mate" in value) {
    if (!isFiniteNumber(value.mate)) return undefined;
    summary.mate = value.mate;
  }
  if ("bestMoveUci" in value) {
    if (!isString(value.bestMoveUci)) return undefined;
    summary.bestMoveUci = value.bestMoveUci;
  }
  if ("classification" in value) {
    if (!isString(value.classification)) return undefined;
    summary.classification = value.classification;
  }
  return summary;
}

function parseMove(value: unknown): PersistedMoveV1 | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (
    !isString(value.from) ||
    !SQUARE_RE.test(value.from) ||
    !isString(value.to) ||
    !SQUARE_RE.test(value.to) ||
    !isString(value.san) ||
    !isString(value.uci) ||
    !isString(value.color) ||
    !COLORS.has(value.color) ||
    !isString(value.piece) ||
    !PIECES.has(value.piece)
  ) {
    return undefined;
  }

  const move: PersistedMoveV1 = {
    from: value.from as Square,
    to: value.to as Square,
    san: value.san,
    uci: value.uci,
    color: value.color as Color,
    piece: value.piece as PieceSymbol,
  };

  if ("promotion" in value && value.promotion !== undefined) {
    if (!isString(value.promotion) || !PIECES.has(value.promotion)) {
      return undefined;
    }
    move.promotion = value.promotion as PieceSymbol;
  }
  if ("captured" in value && value.captured !== undefined) {
    if (!isString(value.captured) || !PIECES.has(value.captured)) {
      return undefined;
    }
    move.captured = value.captured as PieceSymbol;
  }
  return move;
}

function parseNode(value: unknown, id: string): PersistedNodeV1 | null {
  if (!isRecord(value)) return null;
  if (value.id !== id || !isString(value.id)) return null;
  if (!(value.parentId === null || isString(value.parentId))) return null;
  if (!Array.isArray(value.childIds) || !value.childIds.every(isString)) {
    return null;
  }
  if (!isString(value.fen) || !isFiniteNumber(value.ply)) return null;

  const move = parseMove(value.move);
  if (move === undefined) return null;
  const analysis = parseAnalysis(value.analysis);
  if (analysis === undefined) return null;

  let isVariation = false;
  if ("isVariation" in value && value.isVariation !== undefined) {
    if (typeof value.isVariation !== "boolean") return null;
    isVariation = value.isVariation;
  }

  return {
    id: value.id,
    parentId: value.parentId,
    childIds: [...value.childIds],
    fen: value.fen,
    move,
    ply: value.ply,
    analysis,
    isVariation,
  };
}

/**
 * Safe parse for local data. Returns null for missing/corrupt payloads.
 * Never constructs live Chess instances or pending jobs.
 */
export function parsePersistedGame(raw: unknown): PersistedGame | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1) return null;
  if (!isString(raw.updatedAt)) return null;
  if (!isRecord(raw.tree) || !isRecord(raw.session)) return null;

  const { tree, session } = raw;
  if (!isString(tree.rootId) || !isString(tree.currentNodeId)) return null;
  if (!isRecord(tree.nodes)) return null;

  const nodes: Record<string, PersistedNodeV1> = {};
  for (const [id, nodeRaw] of Object.entries(tree.nodes)) {
    const node = parseNode(nodeRaw, id);
    if (!node) return null;
    nodes[id] = node;
  }

  if (!nodes[tree.rootId] || !nodes[tree.currentNodeId]) return null;

  // Structural integrity: parent/child links, root shape, cycles, FENs, moves.
  for (const node of Object.values(nodes)) {
    if (node.parentId !== null && !nodes[node.parentId]) return null;
    if (!isValidFen(node.fen)) return null;

    // Reject parent cycles (would hang getAncestors / resume).
    const seen = new Set<string>();
    let cursor: string | null = node.id;
    while (cursor) {
      if (seen.has(cursor)) return null;
      seen.add(cursor);
      const walk: PersistedNodeV1 | undefined = nodes[cursor];
      if (!walk) return null;
      cursor = walk.parentId;
    }

    for (const childId of node.childIds) {
      const child = nodes[childId];
      if (!child || child.parentId !== node.id) return null;
      if (!child.move) return null;
      const applied = tryApplyMove(node.fen, child.move.uci);
      if (!applied || applied.fenAfter !== child.fen) return null;
    }
  }
  if (nodes[tree.rootId]!.parentId !== null) return null;
  if (nodes[tree.rootId]!.move !== null) return null;

  if (!isString(session.mode) || !SESSION_MODES.has(session.mode as SessionMode)) {
    return null;
  }
  const mode = session.mode as SessionMode;
  if (
    !(
      session.errorMessage === null ||
      isString(session.errorMessage)
    )
  ) {
    return null;
  }

  const terminalReason = session.terminalReason ?? null;
  const allowedReasons = new Set<PersistedGameV1["session"]["terminalReason"]>([
    null,
    "ongoing",
    "checkmate",
    "stalemate",
    "threefold",
    "fiftyMove",
    "insufficientMaterial",
    "draw",
    "resignation",
  ]);
  if (
    !(
      terminalReason === null ||
      (typeof terminalReason === "string" &&
        allowedReasons.has(
          terminalReason as PersistedGameV1["session"]["terminalReason"],
        ))
    )
  ) {
    return null;
  }

  let preferences: PersistedGameV1["preferences"];
  if ("preferences" in raw && raw.preferences !== undefined) {
    if (!isRecord(raw.preferences)) return null;
    preferences = {};
    if ("maiaElo" in raw.preferences && raw.preferences.maiaElo !== undefined) {
      if (!isFiniteNumber(raw.preferences.maiaElo)) return null;
      preferences.maiaElo = raw.preferences.maiaElo;
    }
    if (
      "playerColor" in raw.preferences &&
      raw.preferences.playerColor !== undefined
    ) {
      if (
        !isString(raw.preferences.playerColor) ||
        !COLORS.has(raw.preferences.playerColor)
      ) {
        return null;
      }
      preferences.playerColor = raw.preferences.playerColor as Color;
    }
  }

  return {
    version: 1,
    updatedAt: raw.updatedAt,
    tree: {
      rootId: tree.rootId,
      currentNodeId: tree.currentNodeId,
      nodes,
    },
    session: {
      mode,
      errorMessage: session.errorMessage,
      terminalReason:
        terminalReason as PersistedGameV1["session"]["terminalReason"],
    },
    ...(preferences ? { preferences } : {}),
  };
}

export function toPersistedGame(
  game: GameSession,
  options?: {
    updatedAt?: string;
    preferences?: PersistedGameV1["preferences"];
  },
): PersistedGame {
  const nodes: Record<string, PersistedNodeV1> = {};
  for (const [id, node] of Object.entries(game.tree.nodes)) {
    nodes[id] = persistNode(node);
  }

  return {
    version: GAME_SCHEMA_VERSION,
    updatedAt: options?.updatedAt ?? new Date().toISOString(),
    tree: {
      rootId: game.tree.rootId,
      currentNodeId: game.tree.currentNodeId,
      nodes,
    },
    session: {
      mode: game.session.mode,
      errorMessage: game.session.errorMessage,
      terminalReason: game.session.terminalReason,
    },
    ...(options?.preferences ? { preferences: options.preferences } : {}),
  };
}

function persistNode(node: GameNode): PersistedNodeV1 {
  return {
    id: node.id,
    parentId: node.parentId,
    childIds: [...node.childIds],
    fen: node.fen,
    move: node.move ? persistMove(node.move) : null,
    ply: node.ply,
    analysis: node.analysis,
    isVariation: node.isVariation,
  };
}

function persistMove(move: GameMove): PersistedMoveV1 {
  return {
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion } : {}),
    san: move.san,
    uci: move.uci,
    color: move.color,
    piece: move.piece,
    ...(move.captured ? { captured: move.captured } : {}),
  };
}

export function toGameSession(persisted: PersistedGame): GameSession {
  const nodes: Record<string, GameNode> = {};
  for (const [id, node] of Object.entries(persisted.tree.nodes)) {
    nodes[id] = {
      id: node.id,
      parentId: node.parentId,
      childIds: [...node.childIds],
      fen: node.fen,
      move: node.move,
      ply: node.ply,
      analysis: node.analysis,
      isVariation: node.isVariation === true,
    };
  }

  const tree: GameTree = {
    nodes,
    rootId: persisted.tree.rootId,
    currentNodeId: persisted.tree.currentNodeId,
  };

  return {
    tree,
    session: {
      mode: persisted.session.mode,
      errorMessage: persisted.session.errorMessage,
      terminalReason: persisted.session.terminalReason,
    },
  };
}
