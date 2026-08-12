import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSITION,
  getLegalMoves,
  getStatus,
  getStatusAlongPath,
  isLegalMove,
  moveToUci,
  parseUci,
  sanToUci,
  tryApplyMove,
  uciToSan,
} from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";

describe("rules wrapper", () => {
  it("lists legal opening moves from the start position", () => {
    const moves = getLegalMoves(DEFAULT_POSITION);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.some((m) => m.uci === "e2e4")).toBe(true);
    expect(isLegalMove(DEFAULT_POSITION, "e2e4")).toBe(true);
    expect(isLegalMove(DEFAULT_POSITION, "e2e5")).toBe(false);
  });

  it("converts between SAN and UCI", () => {
    expect(sanToUci(DEFAULT_POSITION, "e4")).toBe("e2e4");
    expect(uciToSan(DEFAULT_POSITION, "e2e4")).toBe("e4");
    expect(parseUci("e7e8q")).toEqual({
      from: "e7",
      to: "e8",
      promotion: "q",
    });
  });

  it("applies promotion moves", () => {
    const fen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
    const applied = tryApplyMove(fen, { from: "e7", to: "e8", promotion: "q" });
    expect(applied).not.toBeNull();
    expect(applied!.move.promotion).toBe("q");
    expect(applied!.move.san).toContain("=");
    expect(applied!.fenAfter).toContain("Q");
    expect(isLegalMove(fen, "e7e8")).toBe(false);
  });

  it("detects checkmate (fool's mate)", () => {
    let fen = DEFAULT_POSITION;
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
      const applied = tryApplyMove(fen, uci);
      expect(applied).not.toBeNull();
      fen = applied!.fenAfter;
    }
    const status = getStatus(fen);
    expect(status.isCheckmate).toBe(true);
    expect(status.isGameOver).toBe(true);
    expect(status.result).toBe("blackWins");
    expect(status.reason).toBe("checkmate");
  });

  it("detects stalemate", () => {
    const fen = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    const status = getStatus(fen);
    expect(status.isStalemate).toBe(true);
    expect(status.isDraw).toBe(true);
    expect(status.result).toBe("draw");
  });

  it("detects threefold repetition along a path", () => {
    // Knights shuttle: Nb1-c3-b1 / Nb8-c6-b8 repeated.
    const ucis = [
      "b1c3",
      "b8c6",
      "c3b1",
      "c6b8",
      "b1c3",
      "b8c6",
      "c3b1",
      "c6b8",
    ];
    const moves: GameMove[] = [];
    let fen = DEFAULT_POSITION;
    for (const uci of ucis) {
      const applied = tryApplyMove(fen, uci);
      expect(applied).not.toBeNull();
      moves.push(applied!.move);
      fen = applied!.fenAfter;
    }
    const status = getStatusAlongPath(DEFAULT_POSITION, moves);
    expect(status.isThreefoldRepetition).toBe(true);
    expect(status.isDraw).toBe(true);
    expect(status.reason).toBe("threefold");
  });

  it("builds UCI from move fields", () => {
    expect(moveToUci({ from: "e7", to: "e8", promotion: "n" })).toBe("e7e8n");
  });
});
