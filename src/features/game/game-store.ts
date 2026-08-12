"use client";

import { create } from "zustand";
import type { AnalysisSummary } from "@/domain/analysis";
import {
  createBootstrapTree,
  createSessionState,
  currentFen,
  currentStatus,
  getCurrentNode,
  getLegalMoves,
  getMoveHistory,
  getStatusAtNode,
  jumpToGameNode,
  playMove,
  resign,
  retryMove,
  setNodeAnalysis,
  setSessionMode,
  startGame,
  takeback,
  type GameMove,
  type GameSession,
  type GameStatus,
  type GameTree,
  type MoveInput,
  type SessionMode,
} from "@/domain/game";
import {
  createLocalStorageGameRepository,
  toGameSession,
  toPersistedGame,
  type GameRepository,
  type PersistedGame,
} from "@/storage";

export type GameStorePreferences = {
  maiaElo: number;
  playerColor: "w" | "b";
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
  legalMoves: () => GameMove[];
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
  attachAnalysis: (nodeId: string, analysis: AnalysisSummary | null) => boolean;
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
  playerColor: "w",
};

function asGameSession(state: Pick<GameStoreState, "tree" | "session">): GameSession {
  return { tree: state.tree, session: state.session };
}

function applySession(
  set: (partial: Partial<GameStoreState>) => void,
  game: GameSession,
  lastError: string | null = null,
): void {
  set({
    tree: game.tree,
    session: game.session,
    lastError,
  });
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

  fen: () => currentFen(asGameSession(get())),
  status: () => currentStatus(asGameSession(get())),
  legalMoves: () => getLegalMoves(getCurrentNode(get().tree).fen),
  history: () => getMoveHistory(get().tree, get().tree.currentNodeId),

  startGame: (fen?: string) => {
    const result = startGame(fen);
    applySession(set, result.session, null);
    set({ hydrated: true, resumed: false });
  },

  resumePlay: () => {
    const status = currentStatus(asGameSession(get()));
    if (status.isGameOver) {
      set({
        session: {
          mode: "gameOver",
          errorMessage: null,
          terminalReason:
            get().session.terminalReason ?? status.reason,
        },
        lastError: null,
      });
      return;
    }
    const mode: SessionMode =
      status.turn === "w" ? "playerTurn" : "opponentThinking";
    set({
      session: {
        mode,
        errorMessage: null,
        terminalReason: null,
      },
      lastError: null,
    });
  },

  replaceTree: (tree) => {
    set({ tree, lastError: null });
  },

  playMove: (input, options) => {
    const result = playMove(asGameSession(get()), input, options);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    applySession(set, result.session, null);
    return true;
  },

  jumpToNode: (nodeId) => {
    const result = jumpToGameNode(asGameSession(get()), nodeId);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    applySession(set, result.session, null);
    return true;
  },

  takeback: () => {
    const result = takeback(asGameSession(get()));
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    applySession(set, result.session, null);
    return true;
  },

  retryMove: () => {
    const result = retryMove(asGameSession(get()));
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    applySession(set, result.session, null);
    return true;
  },

  attachAnalysis: (nodeId, analysis) => {
    const nextTree = setNodeAnalysis(get().tree, nodeId, analysis);
    if (!nextTree) {
      set({ lastError: `Unknown node: ${nodeId}` });
      return false;
    }
    set({ tree: nextTree, lastError: null });
    return true;
  },

  resign: (winner = "black") => {
    const result = resign(asGameSession(get()), winner);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    applySession(set, result.session, null);
    return true;
  },

  setMode: (mode, errorMessage) => {
    const result = setSessionMode(asGameSession(get()), mode, { errorMessage });
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    // Keep engine/session error text in lastError so StatusPanel can show it.
    applySession(
      set,
      result.session,
      mode === "error"
        ? (result.session.session.errorMessage ?? errorMessage ?? null)
        : null,
    );
    return true;
  },

  setMaiaElo: (elo) => {
    const clamped = Math.min(1900, Math.max(1100, Math.round(elo / 100) * 100));
    set({
      preferences: {
        ...get().preferences,
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
      const game = normalizeSessionForResume(toGameSession(loaded));
      // Touch path status so illegal FENs / cycles that slipped past parse throw here.
      getStatusAtNode(game.tree, game.tree.currentNodeId);
      applySession(set, game, null);
      set({
        hydrated: true,
        resumed: Object.keys(game.tree.nodes).length > 1,
        preferences: {
          maiaElo: loaded.preferences?.maiaElo ?? defaultPreferences.maiaElo,
          playerColor:
            loaded.preferences?.playerColor ?? defaultPreferences.playerColor,
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
    const snapshot: PersistedGame = toPersistedGame(asGameSession(state), {
      preferences: state.preferences,
    });
    await repository.save(snapshot);
  },

  clearPersisted: async (repository = defaultRepository()) => {
    await repository.clear();
  },
}));
