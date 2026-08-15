import { describe, expect, it } from "vitest";
import { projectUciLine } from "@/domain/analysis/projected-lines";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("projectUciLine", () => {
  it("validates and caps plies", () => {
    const line = projectUciLine({
      rootFen: START,
      rootNodeId: "root",
      lineUci: ["e2e4", "e7e5", "g1f3"],
      maxPlies: 1,
    });
    expect(line.plies).toHaveLength(1);
    expect(line.plies[0]?.san).toBe("e4");
    expect(line.plies[0]?.pathKey).toBe("e2e4");
    expect(line.kind).toBe("suggested");
  });

  it("drops illegal suffixes", () => {
    const line = projectUciLine({
      rootFen: START,
      rootNodeId: "root",
      lineUci: ["e2e4", "e2e4"],
    });
    expect(line.plies).toHaveLength(1);
    expect(line.kind).toBe("suggested");
  });
});
