import { describe, expect, it } from "vitest";
import { squareToIndex } from "@/engines/maia/encode";
import {
  BASE_MOVE_COUNT,
  getAllPossibleMoves,
  indexToMove,
  MOVE_VOCAB_SIZE,
  moveToIndex,
  promotionMoveIndex,
  quietMoveIndex,
} from "@/engines/maia/vocabulary";

describe("Maia move vocabulary", () => {
  it("has exactly 4352 entries with 256 promotions", () => {
    const moves = getAllPossibleMoves();
    expect(moves).toHaveLength(MOVE_VOCAB_SIZE);
    expect(BASE_MOVE_COUNT).toBe(4096);
    expect(moves.slice(BASE_MOVE_COUNT).every((m) => m.length === 5)).toBe(
      true,
    );
    expect(moves[BASE_MOVE_COUNT]).toBe("a7a8q");
    expect(moves[MOVE_VOCAB_SIZE - 1]).toBe("h7h8n");
  });

  it("round-trips quiet moves and promotions", () => {
    for (const uci of ["e2e4", "a1a1", "h7h8", "e7e8q", "a7b8n", "h7g8r"]) {
      const idx = moveToIndex(uci);
      expect(idx).toBeTypeOf("number");
      expect(indexToMove(idx!)).toBe(uci);
    }
  });

  it("places e2e4 and e7e8q at upstream indices", () => {
    // e2 = file4+rank1*8 = 12; e4 = 28 → 12*64+28 = 796
    expect(quietMoveIndex(squareToIndex("e2"), squareToIndex("e4"))).toBe(796);
    expect(moveToIndex("e2e4")).toBe(796);
    // e7e8q: file_from=4, file_to=4, piece q=0 → 4096 + (4*8+4)*4 + 0 = 4240
    expect(promotionMoveIndex(4, 4, "q")).toBe(4240);
    expect(moveToIndex("e7e8q")).toBe(4240);
  });

  it("includes all four promotion pieces per file pair", () => {
    expect(moveToIndex("e7e8q")).toBe(promotionMoveIndex(4, 4, "q"));
    expect(moveToIndex("e7e8r")).toBe(promotionMoveIndex(4, 4, "r"));
    expect(moveToIndex("e7e8b")).toBe(promotionMoveIndex(4, 4, "b"));
    expect(moveToIndex("e7e8n")).toBe(promotionMoveIndex(4, 4, "n"));
  });
});
