"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getNode, getTurn, isHumanTurn } from "@/domain/game";
import {
  type CoachingController,
  createCoachingController,
} from "@/features/game/coaching-controller";
import { useGameStore } from "@/features/game/game-store";
import {
  createMaiaSession,
  type MaiaSession,
} from "@/features/game/maia-session";

const COACH_UNAVAILABLE_FALLBACK =
  "Coach analysis unavailable — play continues without post-move feedback.";

export type GameRuntimeOptions = {
  createMaiaSession?: () => MaiaSession;
  createCoachingController?: () => CoachingController;
};

export type GameRuntime = {
  maiaSession: MaiaSession;
  coach: CoachingController;
  maia: ReturnType<MaiaSession["getState"]>;
  coaching: ReturnType<CoachingController["getState"]>;
  coachUnavailable: string | null;
  enginesWarming: boolean;
  engineNoticeArmed: boolean;
  retryEngines: () => Promise<void>;
};

/**
 * Owns engine sessions, hydrate/persist, and future projection.
 * Effects: hydrate once; start engines; debounce persist on tree/session/elo;
 * dispose on unmount; arm the engine-loading notice; project Stockfish futures
 * on the live tip while it is the human's turn.
 */
export function useGameRuntime(options: GameRuntimeOptions = {}): GameRuntime {
  const hydrated = useGameStore((s) => s.hydrated);
  const tree = useGameStore((s) => s.tree);
  const mode = useGameStore((s) => s.session.mode);
  const terminalReason = useGameStore((s) => s.session.terminalReason);
  const maiaElo = useGameStore((s) => s.preferences.maiaElo);
  const hydrate = useGameStore((s) => s.hydrate);
  const persist = useGameStore((s) => s.persist);
  const setMode = useGameStore((s) => s.setMode);
  const resumePlay = useGameStore((s) => s.resumePlay);

  const [maiaSession] = useState<MaiaSession>(
    () => options.createMaiaSession?.() ?? createMaiaSession(),
  );
  const [coach] = useState<CoachingController>(
    () => options.createCoachingController?.() ?? createCoachingController(),
  );
  const [coachUnavailable, setCoachUnavailable] = useState<string | null>(null);
  const [engineNoticeArmed, setEngineNoticeArmed] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maia = useSyncExternalStore(
    maiaSession.subscribe,
    maiaSession.getState,
    maiaSession.getState,
  );
  const coaching = useSyncExternalStore(
    coach.subscribe,
    coach.getState,
    coach.getState,
  );

  const enginesWarming =
    maia.phase === "starting" ||
    maia.phase === "idle" ||
    coaching.phase === "starting" ||
    coaching.phase === "idle";

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void maiaSession.start();
    void coach.start().then((ok) => {
      setCoachUnavailable(
        ok ? null : (coach.getState().message ?? COACH_UNAVAILABLE_FALLBACK),
      );
    });
  }, [maiaSession, coach]);

  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void persist();
    }, 250);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [hydrated, tree, mode, terminalReason, maiaElo, persist]);

  useEffect(() => {
    return () => {
      void maiaSession.dispose();
      void coach.dispose();
    };
  }, [maiaSession, coach]);

  useEffect(() => {
    if (!(enginesWarming && maia.phase !== "failed")) {
      const reset = setTimeout(() => setEngineNoticeArmed(false), 0);
      return () => clearTimeout(reset);
    }
    const arm = setTimeout(() => setEngineNoticeArmed(true), 400);
    return () => clearTimeout(arm);
  }, [enginesWarming, maia.phase]);

  useEffect(() => {
    if (!hydrated) return;
    if (mode === "gameOver" || mode === "error") return;
    const tipId = tree.currentNodeId;
    const tip = getNode(tree, tipId);
    if (!tip) return;
    if (!isHumanTurn(getTurn(tip.fen))) {
      coach.clearFuture();
      return;
    }
    void coach.projectFuture({
      fen: tip.fen,
      gameNodeId: tipId,
    });
  }, [hydrated, tree, mode, coach]);

  async function retryEngines(): Promise<void> {
    await maiaSession.dispose();
    await coach.dispose();
    const [maiaOk, coachOk] = await Promise.all([
      maiaSession.start(),
      coach.start(),
    ]);
    if (!maiaOk) {
      setMode(
        "error",
        maiaSession.getState().message ?? "Maia failed to start",
      );
      return;
    }
    setCoachUnavailable(
      coachOk ? null : (coach.getState().message ?? COACH_UNAVAILABLE_FALLBACK),
    );
    if (useGameStore.getState().session.mode === "error") {
      resumePlay();
    }
  }

  return {
    maiaSession,
    coach,
    maia,
    coaching,
    coachUnavailable,
    enginesWarming,
    engineNoticeArmed,
    retryEngines,
  };
}
