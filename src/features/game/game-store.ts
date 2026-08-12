"use client";

import { create } from "zustand";
import {
  createBootstrapTree,
  createInitialTree,
  createSessionState,
  type GameMove,
  type GameSession,
  type GameStatus,
  type GameTree,
  getCurrentNode,
  getMoveHistory,
  getStatusAtNode,
  jumpToNode,
  type MoveInput,
  playMoveOnTree,
  type SessionMode,
  type SessionState,
  takebackOne,
} from "@/domain/game";
import {
  createLocalStorageGameRepository,
  type GameRepository,
  reconstructGame,
  type SavedGameV2,
  toPersistedGame,
} from "@/storage";

export type GameStorePreferences = {
  maiaElo: number;
};

export type GameStoreState = {
  tree: GameSession["tree"];
  session: GameSession["session"];
  preferences: GameStorePreferences;
  hydrated: boolean;
  /** True when a persisted snapshot was loaded (tree may be resumed). */
  resumed: boolean;
  lastError: string | null;

  /** Derived helpers — components should not mutate tree/session directly. */
  fen: () => string;
  status: () => GameStatus;
  history: () => GameMove[];

  startGame: (fen?: string) => void;
  /** Continue a hydrated game without wiping the tree. */
  resumePlay: () => void;
  replaceTree: (tree: GameTree) => void;
  playMove: (
    input: MoveInput,
    options?: { afterMode?: SessionMode; asVariation?: boolean },
  ) => boolean;
  jumpToNode: (nodeId: string) => boolean;
  takeback: () => boolean;
  retryMove: () => boolean;
  resign: (winner?: "white" | "black") => boolean;
  setMode: (mode: SessionMode, errorMessage?: string | null) => boolean;
  setMaiaElo: (elo: number) => void;

  hydrate: (repository?: GameRepository) => Promise<boolean>;
  persist: (repository?: GameRepository) => Promise<void>;
  clearPersisted: (repository?: GameRepository) => Promise<void>;
};

/**
 * Drop transient engine/UI modes on reload. Workers and pending jobs are never
 * serialized — resume into reviewing / gameOver / playerTurn only.
 */
export function normalizeSessionForResume(game: GameSession): GameSession {
  const status = getStatusAtNode(game.tree, game.tree.currentNodeId);
  if (status.isGameOver || game.session.mode === "gameOver") {
    return {
      tree: game.tree,
      session: {
        mode: "gameOver",
        errorMessage: null,
        terminalReason: game.session.terminalReason ?? status.reason,
      },
    };
  }

  const hasMoves = Object.keys(game.tree.nodes).length > 1;
  if (!hasMoves) {
    return {
      tree: game.tree,
      session: {
        mode: "loading",
        errorMessage: null,
        terminalReason: null,
      },
    };
  }

  return {
    tree: game.tree,
    session: {
      mode: "reviewing",
      errorMessage: null,
      terminalReason: null,
    },
  };
}

const defaultPreferences: GameStorePreferences = {
  maiaElo: 1500,
};

const PLAYABLE_MODES: ReadonlySet<SessionMode> = new Set([
  "playerTurn",
  "opponentThinking",
  "reviewing",
  "analyzing",
]);

const RETRYABLE_MODES: ReadonlySet<SessionMode> = new Set([
  "playerTurn",
  "opponentThinking",
  "analyzing",
  "reviewing",
  "gameOver",
]);

function sessionState(
  mode: SessionMode,
  terminalReason: SessionState["terminalReason"] = null,
): SessionState {
  return {
    mode,
    errorMessage: null,
    terminalReason,
  };
}

function defaultRepository(): GameRepository {
  return createLocalStorageGameRepository();
}

const initial = {
  tree: createBootstrapTree(),
  session: createSessionState("loading"),
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  tree: initial.tree,
  session: initial.session,
  preferences: defaultPreferences,
  hydrated: false,
  resumed: false,
  lastError: null,

  fen: () => getCurrentNode(get().tree).fen,
  status: () => getStatusAtNode(get().tree, get().tree.currentNodeId),
  history: () => getMoveHistory(get().tree, get().tree.currentNodeId),

  startGame: (fen?: string) => {
    set({
      tree: createInitialTree(fen),
      session: sessionState("playerTurn"),
      lastError: null,
      hydrated: true,
      resumed: false,
    });
  },

  resumePlay: () => {
    const status = get().status();
    if (status.isGameOver) {
      set({
        session: sessionState(
          "gameOver",
          get().session.terminalReason ?? status.reason,
        ),
        lastError: null,
      });
      return;
    }
    const mode: SessionMode =
      status.turn === "w" ? "playerTurn" : "opponentThinking";
    set({
      session: sessionState(mode),
      lastError: null,
    });
  },

  replaceTree: (tree) => {
    set({ tree, lastError: null });
  },

  playMove: (input, options) => {
    const { tree, session } = get();
    if (!PLAYABLE_MODES.has(session.mode)) {
      set({ lastError: `Cannot play a move while in mode ${session.mode}` });
      return false;
    }

    const played = playMoveOnTree(tree, tree.currentNodeId, input, {
      asVariation: options?.asVariation,
    });
    if (!played) {
      set({ lastError: "Illegal move" });
      return false;
    }

    const status = getStatusAtNode(played.tree, played.tree.currentNodeId);
    let mode: SessionMode =
      options?.afterMode ??
      (session.mode === "opponentThinking" ? "playerTurn" : "opponentThinking");
    let terminalReason: SessionState["terminalReason"] = null;

    if (status.isGameOver) {
      mode = "gameOver";
      terminalReason = status.reason;
    }

    set({
      tree: played.tree,
      session: sessionState(mode, terminalReason),
      lastError: null,
    });
    return true;
  },

  jumpToNode: (nodeId) => {
    const nextTree = jumpToNode(get().tree, nodeId);
    if (!nextTree) {
      set({ lastError: `Unknown node: ${nodeId}` });
      return false;
    }

    const status = getStatusAtNode(nextTree, nodeId);
    if (status.isGameOver) {
      set({
        tree: nextTree,
        session: sessionState("gameOver", status.reason),
        lastError: null,
      });
      return true;
    }

    set({
      tree: nextTree,
      session: sessionState("reviewing"),
      lastError: null,
    });
    return true;
  },

  takeback: () => {
    const nextTree = takebackOne(get().tree);
    if (!nextTree) {
      set({ lastError: "Nothing to take back" });
      return false;
    }

    const { mode } = get().session;
    const nextMode: SessionMode =
      mode === "gameOver" ||
      mode === "analyzing" ||
      mode === "playerTurn" ||
      mode === "opponentThinking"
        ? "reviewing"
        : mode;

    set({
      tree: nextTree,
      session: sessionState(nextMode),
      lastError: null,
    });
    return true;
  },

  retryMove: () => {
    const { session } = get();
    if (!RETRYABLE_MODES.has(session.mode)) {
      set({ lastError: `Cannot retry while in mode ${session.mode}` });
      return false;
    }

    const nextTree = takebackOne(get().tree);
    if (!nextTree) {
      set({ lastError: "Nothing to retry" });
      return false;
    }

    // v1: human plays White.
    const status = getStatusAtNode(nextTree, nextTree.currentNodeId);
    const mode: SessionMode =
      status.turn === "w" ? "playerTurn" : "opponentThinking";

    set({
      tree: nextTree,
      session: sessionState(mode),
      lastError: null,
    });
    return true;
  },

  resign: (_winner = "black") => {
    void _winner;
    const { session } = get();
    if (session.mode === "loading" || session.mode === "error") {
      set({ lastError: `Cannot resign while in mode ${session.mode}` });
      return false;
    }

    set({
      session: sessionState("gameOver", "resignation"),
      lastError: null,
    });
    return true;
  },

  setMode: (mode, errorMessage) => {
    const prev = get().session;
    const terminalReason =
      mode === "gameOver"
        ? prev.terminalReason
        : mode === "loading"
          ? null
          : prev.terminalReason;

    set({
      session: sessionState(mode, terminalReason),
      lastError:
        mode === "error"
          ? (errorMessage ?? prev.errorMessage ?? "Unknown error")
          : null,
    });
    return true;
  },

  setMaiaElo: (elo) => {
    const clamped = Math.min(1900, Math.max(1100, Math.round(elo / 100) * 100));
    set({
      preferences: {
        maiaElo: clamped,
      },
    });
  },

  hydrate: async (repository = defaultRepository()) => {
    try {
      const loaded = await repository.load();
      if (!loaded) {
        set({ hydrated: true, resumed: false });
        return false;
      }
      const reconstructed = reconstructGame(loaded);
      if (!reconstructed) {
        set({
          hydrated: true,
          resumed: false,
          lastError: "Saved game was corrupt and could not be restored",
        });
        return false;
      }

      const baseSession: GameSession = {
        tree: reconstructed.tree,
        session: reconstructed.resigned
          ? sessionState("gameOver", "resignation")
          : createSessionState("reviewing"),
      };
      const game = normalizeSessionForResume(baseSession);
      getStatusAtNode(game.tree, game.tree.currentNodeId);
      set({
        tree: game.tree,
        session: game.session,
        lastError: null,
        hydrated: true,
        resumed: Object.keys(game.tree.nodes).length > 1,
        preferences: {
          maiaElo: reconstructed.maiaElo,
        },
      });
      return true;
    } catch {
      set({
        hydrated: true,
        resumed: false,
        lastError: "Saved game was corrupt and could not be restored",
      });
      return false;
    }
  },

  persist: async (repository = defaultRepository()) => {
    const state = get();
    const snapshot: SavedGameV2 = toPersistedGame(state.tree, {
      maiaElo: state.preferences.maiaElo,
      resigned: state.session.terminalReason === "resignation",
    });
    await repository.save(snapshot);
  },

  clearPersisted: async (repository = defaultRepository()) => {
    await repository.clear();
  },
}));
