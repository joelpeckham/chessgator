import { createCoachingController } from "@/features/game/coaching-controller";
import { createStubAnalysisEngine } from "@/features/game/stub-analysis";
import { createStubMaiaSession } from "@/features/game/stub-maia";
import type { GameRuntimeOptions } from "@/features/game/use-game-runtime";

/** Playwright URL contract: `?e2eStub=1|coach|fallback`. */
export function resolveGameRuntimeOptions(): GameRuntimeOptions {
  if (typeof window === "undefined") return {};
  const stub = new URLSearchParams(window.location.search).get("e2eStub");
  if (stub !== "1" && stub !== "coach" && stub !== "fallback") {
    return {};
  }
  return {
    stubMode: true,
    createMaiaSession:
      stub === "fallback"
        ? undefined
        : () =>
            createStubMaiaSession({
              initDelayMs: 40,
              moveDelayMs: 20,
              scriptedMoves: stub === "coach" ? ["e7e5"] : undefined,
            }),
    createCoachingController: () =>
      createCoachingController({
        createEngine: () => createStubAnalysisEngine(),
      }),
  };
}
