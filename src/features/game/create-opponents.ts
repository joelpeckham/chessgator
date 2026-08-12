import { MaiaOpponent } from "@/engines/maia";
import { StockfishOpponent } from "@/engines/stockfish";
import type { OpponentEngine } from "@/engines/shared/opponent";
import { StubOpponent } from "@/features/game/stub-opponent";

export type OpponentPair = {
  primary: OpponentEngine;
  fallback: OpponentEngine;
};

export type CreateOpponentsFn = () => OpponentPair;

declare global {
  interface Window {
    __chessTutorCreateOpponents?: CreateOpponentsFn;
  }
}

/**
 * Resolve primary (Maia) + fallback (Stockfish) opponents.
 * Playwright can inject stubs via `?e2eStub=1`, `?e2eStub=fallback`, or
 * `window.__chessTutorCreateOpponents`.
 */
export function createOpponents(): OpponentPair {
  if (typeof window !== "undefined") {
    if (typeof window.__chessTutorCreateOpponents === "function") {
      return window.__chessTutorCreateOpponents();
    }

    const stub = new URLSearchParams(window.location.search).get("e2eStub");
    if (stub === "1" || stub === "coach") {
      return {
        primary: new StubOpponent({
          source: "maia",
          initDelayMs: 40,
          moveDelayMs: 20,
          // Deterministic reply after 1.e4 for coaching e2e.
          scriptedMoves: stub === "coach" ? ["e7e5"] : undefined,
        }),
        fallback: new StubOpponent({ source: "stockfish" }),
      };
    }
    if (stub === "fallback") {
      return {
        primary: new StubOpponent({
          source: "maia",
          failInit: true,
          initDelayMs: 40,
        }),
        fallback: new StubOpponent({
          source: "stockfish",
          initDelayMs: 40,
          moveDelayMs: 20,
        }),
      };
    }
  }

  return {
    primary: new MaiaOpponent(),
    fallback: new StockfishOpponent(),
  };
}
