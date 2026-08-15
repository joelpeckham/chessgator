import { describe, expect, it } from "vitest";
import { movesToPgn, pgnResultTag } from "@/domain/game/pgn";
import { DEFAULT_POSITION, tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";

function play(fen: string, san: string): { fen: string; move: GameMove } {
  const applied = tryApplyMove(fen, san);
  if (!applied) throw new Error(`illegal ${san}`);
  return { fen: applied.fenAfter, move: applied.move };
}

describe("movesToPgn", () => {
  it("replays opening moves and tags an unfinished result", () => {
    const e4 = play(DEFAULT_POSITION, "e4");
    const e5 = play(e4.fen, "e5");
    const pgn = movesToPgn({ moves: [e4.move, e5.move] });
    expect(pgn).toContain("1. e4 e5");
    expect(pgn).toContain('[Result "*"]');
  });

  it("records a decisive result header", () => {
    expect(pgnResultTag("whiteWins")).toBe("1-0");
    const e4 = play(DEFAULT_POSITION, "e4");
    const pgn = movesToPgn({
      moves: [e4.move],
      result: "whiteWins",
    });
    expect(pgn).toContain('[Result "1-0"]');
  });
});
