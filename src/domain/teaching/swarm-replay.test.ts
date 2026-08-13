import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";
import { selectTeachingInsight } from "@/domain/teaching/select-insight";

type CachedMove = {
  uci: string;
  fenBefore: string;
  evalBeforeCp: number | null;
  evalAfterCp: number | null;
};

type CachedGame = {
  gameId: string;
  moves: CachedMove[];
};

const FIXTURE_DIR = join(
  import.meta.dirname,
  "../../../scripts/fixtures/lichess-game-coaching",
);

function loadCachedGames(): CachedGame[] {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => {
      const raw = JSON.parse(
        readFileSync(join(FIXTURE_DIR, name), "utf8"),
      ) as CachedGame;
      return raw;
    });
}

function score(cp: number | null): AnalysisEvidence["score"] {
  return { cp: cp ?? 0 };
}

function evidenceFor(
  fen: string,
  cp: number | null,
  bestMoveUci: string,
): AnalysisEvidence {
  return {
    requestId: "replay",
    gameNodeId: "replay",
    fen,
    sideToMove: fen.split(" ")[1] === "b" ? "b" : "w",
    score: score(cp),
    bestMoveUci,
    lines: [{ multipv: 1, score: score(cp), pvUci: [bestMoveUci] }],
  };
}

describe("cached Lichess game replay smoke", () => {
  it("never emits the worst swarm slogans on the 50-game corpus", () => {
    const games = loadCachedGames();
    expect(games.length).toBe(50);
    let plies = 0;

    for (const game of games) {
      let previousMove: GameMove | null = null;
      for (const move of game.moves) {
        const applied = tryApplyMove(move.fenBefore, move.uci);
        if (!applied) continue;
        const insight = selectTeachingInsight(
          buildMoveAnalysisEvidence({
            requestId: `${game.gameId}:${move.uci}`,
            gameNodeId: `${game.gameId}:${move.uci}`,
            playedMove: applied.move,
            previousMove,
            fenBefore: move.fenBefore,
            fenAfter: applied.fenAfter,
            before: evidenceFor(move.fenBefore, move.evalBeforeCp, move.uci),
            after: evidenceFor(applied.fenAfter, move.evalAfterCp, move.uci),
          }),
        );
        const text = insight.explanation.toLowerCase();
        expect(text).not.toMatch(/forces the king to respond/);
        expect(text).not.toMatch(/and then pin /);
        expect(text).not.toMatch(/and then take /);
        expect(text).not.toMatch(/and then fork /);
        expect(text).not.toMatch(
          /is a (blunder|mistake|inaccuracy) because you take/,
        );
        expect(text).not.toMatch(/a better move would have been [^.]+$/);
        if (/saves your /.test(text) && applied.move.piece !== "p") {
          expect(text).not.toMatch(
            new RegExp(`saves your ${applied.move.to}-`),
          );
        }
        plies += 1;
        previousMove = applied.move;
      }
    }

    expect(plies).toBeGreaterThan(2000);
  });
});
