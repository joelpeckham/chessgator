import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION, getLegalMoves } from "@/domain/game/rules";
import { fromVocabUci } from "@/engines/maia/encode";
import { applyLegalMask, legalMovesMask } from "@/engines/maia/mask";
import { indexToMove, MOVE_VOCAB_SIZE } from "@/engines/maia/vocabulary";

describe("Maia legal masking", () => {
  it("masks exactly the chess.js legal move count at startpos", () => {
    const mask = legalMovesMask(DEFAULT_POSITION);
    expect(mask).toHaveLength(MOVE_VOCAB_SIZE);
    const legalCount = mask.reduce((n, bit) => n + bit, 0);
    expect(legalCount).toBe(getLegalMoves(DEFAULT_POSITION).length);
    expect(legalCount).toBe(20);
  });

  it("never marks illegal vocabulary entries", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const mask = legalMovesMask(fen);
    const legalSet = new Set(getLegalMoves(fen).map((m) => m.uci));
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const vocab = indexToMove(i)!;
      const boardUci = fromVocabUci(fen, vocab);
      expect(legalSet.has(boardUci)).toBe(true);
    }
  });

  it("applies -Infinity to illegal logits", () => {
    const mask = new Uint8Array(4);
    mask[1] = 1;
    mask[3] = 1;
    const masked = applyLegalMask([1, 2, 3, 4], mask);
    expect(masked[0]).toBe(Number.NEGATIVE_INFINITY);
    expect(masked[1]).toBe(2);
    expect(masked[2]).toBe(Number.NEGATIVE_INFINITY);
    expect(masked[3]).toBe(4);
  });
});
