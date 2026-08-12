import { createNodeId } from "@/domain/game/id";
import { isValidFen, tryApplyMove } from "@/domain/game/rules";
import type { GameNode, GameTree } from "@/domain/game/types";

export const GAME_SCHEMA_VERSION = 2 as const;
export const GAME_STORAGE_KEY = "chessgator:game:v2";
/** Legacy key — ignored / cleared; no v1→v2 migration. */
export const LEGACY_GAME_STORAGE_KEY = "chessgator:game:v1";

export type SavedNode = {
  /** Absent on the root. */
  uci?: string;
  children?: SavedNode[];
};

export type SavedGameV2 = {
  version: 2;
  rootFen: string;
  /** Child indexes among committed (non-variation) children from root → current. */
  currentPath: number[];
  tree: SavedNode;
  maiaElo: number;
  resigned?: true;
};

export type PersistedGame = SavedGameV2;

export type ReconstructedGame = {
  tree: GameTree;
  maiaElo: number;
  resigned: boolean;
};

export interface GameRepository {
  load(): Promise<SavedGameV2 | null>;
  save(game: SavedGameV2): Promise<void>;
  clear(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function committedChildren(
  tree: GameTree,
  nodeId: string,
): GameNode[] {
  const node = tree.nodes[nodeId];
  if (!node) return [];
  const out: GameNode[] = [];
  for (const childId of node.childIds) {
    const child = tree.nodes[childId];
    if (child && !child.isVariation) {
      out.push(child);
    }
  }
  return out;
}

/** Nearest committed (non-variation) ancestor, or the node itself if committed. */
function nearestCommittedNodeId(tree: GameTree, nodeId: string): string {
  let current = tree.nodes[nodeId];
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    if (!current.isVariation) {
      return current.id;
    }
    if (!current.parentId) break;
    current = tree.nodes[current.parentId];
  }
  return tree.rootId;
}

function persistCommittedSubtree(tree: GameTree, nodeId: string): SavedNode {
  const node = tree.nodes[nodeId]!;
  const children = committedChildren(tree, nodeId).map((child) =>
    persistCommittedSubtree(tree, child.id),
  );
  const saved: SavedNode = {};
  if (node.move?.uci) {
    saved.uci = node.move.uci;
  }
  if (children.length > 0) {
    saved.children = children;
  }
  return saved;
}

function pathToNode(
  tree: GameTree,
  targetId: string,
): number[] | null {
  const path: number[] = [];
  const ancestors: string[] = [];
  let cursor: string | null = targetId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return null;
    seen.add(cursor);
    ancestors.push(cursor);
    const node: GameNode | undefined = tree.nodes[cursor];
    if (!node) return null;
    if (cursor === tree.rootId) break;
    cursor = node.parentId;
  }
  ancestors.reverse();
  if (ancestors[0] !== tree.rootId) return null;

  for (let i = 0; i < ancestors.length - 1; i += 1) {
    const parentId = ancestors[i]!;
    const childId = ancestors[i + 1]!;
    const siblings = committedChildren(tree, parentId);
    const index = siblings.findIndex((n) => n.id === childId);
    if (index < 0) return null;
    path.push(index);
  }
  return path;
}

export function toPersistedGame(
  tree: GameTree,
  options: { maiaElo: number; resigned?: boolean },
): SavedGameV2 {
  const root = tree.nodes[tree.rootId];
  if (!root) {
    throw new Error(`Missing root node: ${tree.rootId}`);
  }

  const targetId = nearestCommittedNodeId(tree, tree.currentNodeId);
  const currentPath = pathToNode(tree, targetId) ?? [];

  const saved: SavedGameV2 = {
    version: 2,
    rootFen: root.fen,
    currentPath,
    tree: persistCommittedSubtree(tree, tree.rootId),
    maiaElo: options.maiaElo,
  };
  if (options.resigned) {
    saved.resigned = true;
  }
  return saved;
}

function parseSavedNode(value: unknown, isRoot: boolean): SavedNode | null {
  if (!isRecord(value)) return null;

  let uci: string | undefined;
  if ("uci" in value && value.uci !== undefined) {
    if (!isString(value.uci) || value.uci.length < 4) return null;
    uci = value.uci;
  }
  if (!isRoot && !uci) return null;
  if (isRoot && uci) return null;

  let children: SavedNode[] | undefined;
  if ("children" in value && value.children !== undefined) {
    if (!Array.isArray(value.children)) return null;
    children = [];
    for (const childRaw of value.children) {
      const child = parseSavedNode(childRaw, false);
      if (!child) return null;
      children.push(child);
    }
  }

  const node: SavedNode = {};
  if (uci) node.uci = uci;
  if (children && children.length > 0) node.children = children;
  return node;
}

/**
 * Safe parse for local data. Returns null for missing/corrupt payloads.
 * Never constructs live Chess instances or pending jobs.
 */
export function parseSavedGame(raw: unknown): SavedGameV2 | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 2) return null;
  if (!isString(raw.rootFen) || !isValidFen(raw.rootFen)) return null;
  if (!Array.isArray(raw.currentPath)) return null;
  if (!raw.currentPath.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0)) {
    return null;
  }
  if (!isFiniteNumber(raw.maiaElo)) return null;

  const tree = parseSavedNode(raw.tree, true);
  if (!tree) return null;

  if ("resigned" in raw && raw.resigned !== undefined && raw.resigned !== true) {
    return null;
  }

  const saved: SavedGameV2 = {
    version: 2,
    rootFen: raw.rootFen,
    currentPath: [...raw.currentPath],
    tree,
    maiaElo: raw.maiaElo,
  };
  if (raw.resigned === true) {
    saved.resigned = true;
  }
  return saved;
}

/** @deprecated Use parseSavedGame. */
export const parsePersistedGame = parseSavedGame;

/**
 * Rebuild a GameTree with fresh IDs. Fails closed on illegal UCI / bad path.
 */
export function reconstructGame(saved: SavedGameV2): ReconstructedGame | null {
  if (!isValidFen(saved.rootFen)) return null;

  const rootId = createNodeId();
  const root: GameNode = {
    id: rootId,
    parentId: null,
    childIds: [],
    fen: saved.rootFen,
    move: null,
    ply: 0,
    isVariation: false,
  };

  const nodes: Record<string, GameNode> = { [rootId]: root };

  function addChildren(parentId: string, savedChildren: SavedNode[] | undefined): boolean {
    if (!savedChildren || savedChildren.length === 0) return true;
    const parent = nodes[parentId]!;
    const childIds: string[] = [];

    for (const savedChild of savedChildren) {
      if (!savedChild.uci) return false;
      const applied = tryApplyMove(parent.fen, savedChild.uci);
      if (!applied) return false;

      const childId = createNodeId();
      const child: GameNode = {
        id: childId,
        parentId,
        childIds: [],
        fen: applied.fenAfter,
        move: applied.move,
        ply: parent.ply + 1,
        isVariation: false,
      };
      nodes[childId] = child;
      childIds.push(childId);

      if (!addChildren(childId, savedChild.children)) {
        return false;
      }
    }

    nodes[parentId] = { ...parent, childIds };
    return true;
  }

  if (!addChildren(rootId, saved.tree.children)) {
    return null;
  }

  let currentNodeId = rootId;
  let cursor = rootId;
  for (const index of saved.currentPath) {
    const node = nodes[cursor];
    if (!node || index < 0 || index >= node.childIds.length) {
      return null;
    }
    currentNodeId = node.childIds[index]!;
    cursor = currentNodeId;
  }

  return {
    tree: {
      nodes,
      rootId,
      currentNodeId,
    },
    maiaElo: saved.maiaElo,
    resigned: saved.resigned === true,
  };
}

/** @deprecated Use reconstructGame. */
export function toGameSession(persisted: SavedGameV2): {
  tree: GameTree;
  maiaElo: number;
  resigned: boolean;
} | null {
  return reconstructGame(persisted);
}
