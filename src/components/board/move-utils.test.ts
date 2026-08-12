import { describe, expect, it } from "vitest";
import {
  findMove,
  lastMoveSquares,
  legalDestinations,
  moveRequiresPromotion,
} from "@/components/board/move-utils";

describe("board move utils", () => {
  it("lists legal destinations for a selected piece", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(legalDestinations(fen, "e2")).toEqual(["e3", "e4"]);
  });

  it("detects promotion requirements", () => {
    const fen = "8/P7/8/8/8/8/8/4K2k w - - 0 1";
    expect(moveRequiresPromotion(fen, "a7", "a8")).toBe(true);
    expect(findMove(fen, "a7", "a8", "q")?.uci).toBe("a7a8q");
  });

  it("finds non-promotion moves without a promotion piece", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(findMove(fen, "e2", "e4")?.san).toBe("e4");
  });

  it("parses last-move squares from UCI", () => {
    expect(lastMoveSquares("e2e4")).toEqual({ from: "e2", to: "e4" });
    expect(lastMoveSquares("e7e8q")).toEqual({ from: "e7", to: "e8" });
    expect(lastMoveSquares(null)).toBeNull();
    expect(lastMoveSquares("not-a-move")).toBeNull();
  });
});
