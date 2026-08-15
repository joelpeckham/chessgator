"use client";

import { create } from "zustand";
import {
  type Color,
  createBootstrapTree,
  createInitialTree,
  createSessionState,
  DEFAULT_HUMAN_COLOR,
  type GameSession,
  type GameTree,
  getCurrentNode,
  getStatusAtNode,
  getTurn,
  jumpToNode,
  type MoveInput,
  normalizeSessionForResume,
  playMoveOnTree,
  type SessionMode,
  type SessionState,
  sessionModeForTurn,
} from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import {
  lessonsFromSaved,
  lessonsToSaved,
} from "@/features/game/learning-moments";
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
  /** Side the human is playing in the active game. */
  humanColor: Color;
  preferences: GameStorePreferences;
  /** Coaching insights keyed by the analyzed human-move node id. */
  lessons: Readonly<Record<string, TeachingInsight>>;
  hydrated: boolean;
  /** True when a persisted snapshot was loaded (tree may be resumed). */
  resumed: boolean;
  lastError: string | null;

  startGame: (options?: { fen?: string; humanColor?: Color }) => void;
  /** Continue a hydrated game without wiping the tree. */
  resumePlay: () => void;
  replaceTree: (tree: GameTree) => void;
  /** Jump the live pointer to an existing node and sync session mode. */
  goToNode: (nodeId: string) => boolean;
  playMove: (
    input: MoveInput,
    options?: { afterMode?: SessionMode; asVariation?: boolean },
  ) => boolean;
  resign: () => boolean;
  setMode: (mode: SessionMode, errorMessage?: string | null) => boolean;
  setMaiaElo: (elo: number) => void;
  setLesson: (nodeId: string, insight: TeachingInsight) => void;

  hydrate: (repository?: GameRepository) => Promise<boolean>;
  persist: (repository?: GameRepository) => Promise<void>;
  clearPersisted: (repository?: GameRepository) => Promise<void>;
};

const defaultPreferences: GameStorePreferences = {
  maiaElo: 1500,
};

const PLAYABLE_MODES: ReadonlySet<SessionMode> = new Set([
  "playerTurn",
  "opponentThinking",
  "reviewing",
  "analyzing",
]);

function sessionState(
  mode: SessionMode,
  terminalReason: SessionState["terminalReason"] = null,
): SessionState {
  return {
    mode,
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
  humanColor: DEFAULT_HUMAN_COLOR,
  preferences: defaultPreferences,
  lessons: {},
  hydrated: false,
  resumed: false,
  lastError: null,

  startGame: (options) => {
    const humanColor = options?.humanColor ?? get().humanColor;
    const tree = createInitialTree(options?.fen);
    const turn = getTurn(getCurrentNode(tree).fen);
    set({
      tree,
      humanColor,
      session: sessionState(sessionModeForTurn(turn, humanColor)),
      lastError: null,
      hydrated: true,
      resumed: false,
      lessons: {},
    });
  },

  resumePlay: () => {
    const { tree, session, humanColor } = get();
    const status = getStatusAtNode(tree, tree.currentNodeId);
    if (status.isGameOver) {
      set({
        session: sessionState(
          "gameOver",
          session.terminalReason ?? status.reason,
        ),
        lastError: null,
      });
      return;
    }
    set({
      session: sessionState(sessionModeForTurn(status.turn, humanColor)),
      lastError: null,
    });
  },

  replaceTree: (tree) => {
    set({ tree, lastError: null });
  },

  goToNode: (nodeId) => {
    const { tree, session, humanColor } = get();
    const next = jumpToNode(tree, nodeId);
    if (!next) {
      set({ lastError: "Unknown position" });
      return false;
    }

    if (
      session.mode === "gameOver" &&
      session.terminalReason === "resignation"
    ) {
      set({ tree: next, lastError: null });
      return true;
    }

    const status = getStatusAtNode(next, next.currentNodeId);
    if (status.isGameOver) {
      set({
        tree: next,
        session: sessionState("gameOver", status.reason),
        lastError: null,
      });
      return true;
    }

    set({
      tree: next,
      session: sessionState(sessionModeForTurn(status.turn, humanColor)),
      lastError: null,
    });
    return true;
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
      options?.afterMode ?? sessionModeForTurn(status.turn, get().humanColor);
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

  resign: () => {
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
          ? (errorMessage ?? get().lastError ?? "Unknown error")
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

  setLesson: (nodeId, insight) => {
    set({
      lessons: {
        ...get().lessons,
        [nodeId]: insight,
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
      set({
        tree: game.tree,
        session: game.session,
        humanColor: reconstructed.humanColor,
        lastError: null,
        hydrated: true,
        resumed: Object.keys(game.tree.nodes).length > 1,
        preferences: {
          maiaElo: reconstructed.maiaElo,
        },
        lessons: lessonsFromSaved(reconstructed.lessons),
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
    try {
      const state = get();
      const snapshot: SavedGameV2 = toPersistedGame(state.tree, {
        maiaElo: state.preferences.maiaElo,
        humanColor: state.humanColor,
        resigned: state.session.terminalReason === "resignation",
        lessons: lessonsToSaved(state.lessons),
      });
      await repository.save(snapshot);
    } catch (err) {
      set({
        lastError:
          err instanceof Error ? err.message : "Could not save the game",
      });
    }
  },

  clearPersisted: async (repository = defaultRepository()) => {
    await repository.clear();
  },
}));
