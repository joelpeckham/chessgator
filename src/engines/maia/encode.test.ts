import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "@/domain/game/rules";
import {
  encodeTokensForBrowserExport,
  fromVocabUci,
  mirrorMove,
  mirrorSquare,
  squareToIndex,
  tokenizeFen,
  toVocabUci,
} from "@/engines/maia/encode";

function occupiedChannels(
  tokens: Float32Array,
): Array<{ sq: number; ch: number }> {
  const out: Array<{ sq: number; ch: number }> = [];
  for (let sq = 0; sq < 64; sq++) {
    for (let ch = 0; ch < 12; ch++) {
      if (tokens[sq * 12 + ch] === 1) out.push({ sq, ch });
    }
  }
  return out;
}

describe("Maia encoding / mirroring", () => {
  it("mirrors squares and moves vertically", () => {
    expect(mirrorSquare("e2")).toBe("e7");
    expect(mirrorSquare("a1")).toBe("a8");
    expect(mirrorMove("e2e4")).toBe("e7e5");
    expect(mirrorMove("e7e8q")).toBe("e2e1q");
  });

  it("tokenizes startpos with 32 pieces and correct channels", () => {
    const tokens = tokenizeFen(DEFAULT_POSITION);
    expect(tokens).toHaveLength(64 * 12);
    const occ = occupiedChannels(tokens);
    expect(occ).toHaveLength(32);

    // White pawn on e2 → channel 0 at square 12
    expect(tokens[squareToIndex("e2") * 12 + 0]).toBe(1);
    // White king on e1 → channel 5
    expect(tokens[squareToIndex("e1") * 12 + 5]).toBe(1);
    // Black king on e8 → channel 11
    expect(tokens[squareToIndex("e8") * 12 + 11]).toBe(1);
    // Black pawn on e7 → channel 6
    expect(tokens[squareToIndex("e7") * 12 + 6]).toBe(1);
  });

  it("mirrors and color-swaps when Black to move (structural parity)", () => {
    // After 1.e4, Black to move. Upstream board.mirror():
    // white P on e4 → black p on e5; black pieces become white on flipped ranks.
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const tokens = tokenizeFen(fen);

    // Side-to-move (Black) pieces become White after mirror+color-swap, on rank 2.
    // Original black pawn on e7 → mirrored rank 2, color white → channel 0 at e2.
    expect(tokens[squareToIndex("e2") * 12 + 0]).toBe(1);
    // Original white pawn on e4 → mirrored to e5, color black → channel 6 at e5.
    expect(tokens[squareToIndex("e5") * 12 + 6]).toBe(1);
    // Original black king e8 → white king on e1 → channel 5
    expect(tokens[squareToIndex("e1") * 12 + 5]).toBe(1);
  });

  it("maps moves into vocab space when Black to move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(toVocabUci(fen, "e7e5")).toBe("e2e4");
    expect(fromVocabUci(fen, "e2e4")).toBe("e7e5");
  });

  it("encodes browser-export tokens as a 64x12 plane", () => {
    const a = encodeTokensForBrowserExport(DEFAULT_POSITION);
    expect(a.dims).toEqual([1, 64, 12]);
    expect(a.tokens).toHaveLength(64 * 12);
  });
});
