import { describe, expect, it } from "vitest";
import {
  FUTURE_PROJECTION_PLIES,
  projectBestFuture,
  projectUciLine,
} from "@/domain/analysis/projected-lines";
import type { AnalysisEvidence } from "@/domain/analysis/types";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("projectUciLine", () => {
  it("validates and caps plies", () => {
    const line = projectUciLine({
      rootFen: START,
      rootNodeId: "root",
      lineUci: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3"],
      kind: "future",
      maxPlies: FUTURE_PROJECTION_PLIES,
    });
    expect(line.plies).toHaveLength(FUTURE_PROJECTION_PLIES);
    expect(line.plies[0]?.san).toBe("e4");
    expect(line.plies[0]?.pathKey).toBe("e2e4");
    expect(line.plies[1]?.pathKey).toBe("e2e4/e7e5");
  });

  it("drops illegal suffixes", () => {
    const line = projectUciLine({
      rootFen: START,
      rootNodeId: "root",
      lineUci: ["e2e4", "e2e4"],
      kind: "tutor",
    });
    expect(line.plies).toHaveLength(1);
    expect(line.kind).toBe("tutor");
  });
});

describe("projectBestFuture", () => {
  it("uses multipv 1 pv", () => {
    const evidence: AnalysisEvidence = {
      requestId: "r1",
      gameNodeId: "n1",
      fen: START,
      sideToMove: "w",
      score: { cp: 25 },
      bestMoveUci: "e2e4",
      lines: [
        {
          multipv: 1,
          score: { cp: 25 },
          pvUci: ["e2e4", "e7e5", "g1f3"],
        },
      ],
    };
    const line = projectBestFuture(evidence, { maxPlies: 3 });
    expect(line?.plies.map((p) => p.uci)).toEqual(["e2e4", "e7e5", "g1f3"]);
  });
});
