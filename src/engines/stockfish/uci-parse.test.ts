import { describe, expect, it } from "vitest";
import type { PrincipalVariation } from "@/domain/analysis/types";
import { DEFAULT_POSITION } from "@/domain/game/rules";
import {
  applyInfoLine,
  parseBestMove,
  parseInfoLine,
  sideToMoveFromFen,
  sortedLines,
} from "@/engines/stockfish/uci-parse";

describe("parseInfoLine", () => {
  it("parses MultiPV centipawn lines", () => {
    const info = parseInfoLine(
      "info depth 12 seldepth 18 multipv 2 score cp 34 nodes 12000 time 40 pv e2e4 e7e5 g1f3",
    );
    expect(info).toMatchObject({
      depth: 12,
      seldepth: 18,
      multipv: 2,
      score: { cp: 34 },
      nodes: 12000,
      timeMs: 40,
      pvUci: ["e2e4", "e7e5", "g1f3"],
    });
  });

  it("parses mate scores", () => {
    const info = parseInfoLine("info depth 20 multipv 1 score mate 3 pv d8h4");
    expect(info?.score).toEqual({ mate: 3 });
  });

  it("ignores non-PV info noise", () => {
    expect(parseInfoLine("info string available processors 8")).toBeNull();
    expect(parseInfoLine("uciok")).toBeNull();
  });

  it("ignores aspiration-window bound scores", () => {
    expect(
      parseInfoLine(
        "info depth 12 multipv 1 score cp 80 lowerbound nodes 100 pv e2e4",
      ),
    ).toBeNull();
    expect(
      parseInfoLine("info depth 12 multipv 1 score mate 2 upperbound pv d8h4"),
    ).toBeNull();
  });
});

describe("parseBestMove", () => {
  it("parses bestmove and ponder", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({
      bestMoveUci: "e2e4",
      ponderUci: "e7e5",
    });
  });

  it("handles none", () => {
    expect(parseBestMove("bestmove (none)")).toEqual({
      bestMoveUci: null,
      ponderUci: null,
    });
  });
});

describe("applyInfoLine score perspective", () => {
  it("keeps White-to-move scores", () => {
    const map = new Map<number, PrincipalVariation>();
    applyInfoLine(
      map,
      {
        multipv: 1,
        score: { cp: 55 },
        pvUci: ["e2e4"],
      },
      DEFAULT_POSITION,
      "w",
    );
    expect(map.get(1)?.score).toEqual({ cp: 55 });
  });

  it("flips Black-to-move scores into White perspective", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const map = new Map<number, PrincipalVariation>();
    applyInfoLine(
      map,
      {
        multipv: 1,
        score: { cp: 40 },
        pvUci: ["e7e5"],
      },
      fen,
      "b",
    );
    expect(map.get(1)?.score).toEqual({ cp: -40 });
    expect(sideToMoveFromFen(fen)).toBe("b");
  });

  it("sorts MultiPV lines and truncates illegal PV tails", () => {
    const map = new Map<number, PrincipalVariation>();
    applyInfoLine(
      map,
      { multipv: 2, score: { cp: 10 }, pvUci: ["d2d4"] },
      DEFAULT_POSITION,
      "w",
    );
    applyInfoLine(
      map,
      { multipv: 1, score: { cp: 20 }, pvUci: ["e2e4", "e7e5", "a1a1"] },
      DEFAULT_POSITION,
      "w",
    );
    const lines = sortedLines(map);
    expect(lines.map((l) => l.multipv)).toEqual([1, 2]);
    expect(lines[0]?.pvUci).toEqual(["e2e4", "e7e5"]);
  });
});
