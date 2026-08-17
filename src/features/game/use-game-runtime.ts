"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type CoachingController,
  createCoachingController,
} from "@/features/game/coaching-controller";
import { useGameStore } from "@/features/game/game-store";
import {
  createMaiaSession,
  type MaiaSession,
} from "@/features/game/maia-session";
import { parseGameSearch } from "@/lib/game-href";

const COACH_UNAVAILABLE_FALLBACK =
  "Coach analysis unavailable — play continues without post-move feedback.";

export type GameRuntimeOptions = {
  createMaiaSession?: () => MaiaSession;
  createCoachingController?: () => CoachingController;
  stubMode?: boolean;
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
 * Owns engine sessions, hydrate/persist.
 * Effects: hydrate once; start engines; debounce persist on tree/session/elo;
 * dispose on unmount; arm the engine-loading notice.
 */
export function useGameRuntime(options: GameRuntimeOptions = {}): GameRuntime {
  const hydrated = useGameStore((s) => s.hydrated);
  const tree = useGameStore((s) => s.tree);
  const mode = useGameStore((s) => s.session.mode);
  const terminalReason = useGameStore((s) => s.session.terminalReason);
  const maiaElo = useGameStore((s) => s.preferences.maiaElo);
  const lessons = useGameStore((s) => s.lessons);
  const humanColor = useGameStore((s) => s.humanColor);
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
    // Deep-links start a fresh position. Loading a saved game first would
    // leave the shell in reviewing and can clobber the preset on remount.
    if (
      parseGameSearch(window.location.search) ||
      useGameStore.getState().urlPresetApplied
    ) {
      useGameStore.setState({ hydrated: true, resumed: false });
      return;
    }
    // The landing hero may already have hydrated this store. Reloading it
    // would reset a live turn back to reviewing.
    if (useGameStore.getState().hydrated) return;
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
      persistTimer.current = null;
      void persist();
    }, 250);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [
    hydrated,
    tree,
    mode,
    terminalReason,
    maiaElo,
    humanColor,
    lessons,
    persist,
  ]);

  useEffect(() => {
    function flush(): void {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      if (useGameStore.getState().hydrated) {
        void useGameStore.getState().persist();
      }
    }
    function onPageHide(): void {
      flush();
    }
    function onVisibility(): void {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

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
