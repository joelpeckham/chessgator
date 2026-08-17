import { describe, expect, it } from "vitest";
import {
  fenAfterMoves,
  fenSideToMove,
  isTerminalFen,
  isValidFenString,
} from "@/lib/fen-from-moves";

describe("fenAfterMoves", () => {
  it("reaches the Open Sicilian after 1.e4 c5", () => {
    const fen = fenAfterMoves(["e4", "c5"]);
    expect(fen).toMatch(
      /^rnbqkbnr\/pp1ppppp\/8\/2p5\/4P3\/8\/PPPP1PPP\/RNBQKBNR w KQkq /,
    );
  });

  it("returns null on an illegal ply", () => {
    expect(fenAfterMoves(["e4", "e5", "Qh5"])).not.toBeNull();
    expect(fenAfterMoves(["e4", "e5", "Qxh5"])).toBeNull();
  });
});

describe("isValidFenString", () => {
  it("accepts the start position and rejects junk", () => {
    expect(
      isValidFenString(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      ),
    ).toBe(true);
    expect(isValidFenString("not a fen")).toBe(false);
  });
});

describe("fenSideToMove", () => {
  it("reads the side to move from the FEN", () => {
    expect(
      fenSideToMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    ).toBe("white");
    expect(
      fenSideToMove(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      ),
    ).toBe("black");
  });
});

describe("isTerminalFen", () => {
  it("detects checkmate and rejects the start position", () => {
    expect(
      isTerminalFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    ).toBe(false);
    expect(
      isTerminalFen(
        "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
      ),
    ).toBe(true);
  });
});
