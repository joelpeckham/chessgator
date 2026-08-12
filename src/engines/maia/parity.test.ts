/**
 * Parity levels
 * -------------
 * STRUCTURAL (this file, CI unit tests): encoding, vocabulary indices, legal
 * masking, and temperature=0 sampling rules match the CSSLab/maia3 algorithms
 * documented in maia3/dataset.py, utils.py, and uci.py. No model weights.
 *
 * BROWSER-EXPORT SMOKE (tests/maia): real onnxruntime-web inference against
 * the pinned maia3-5m.fp16.onnx asset on Chromium. Asserts a legal move and
 * successful init; does not claim bit-exact match to the Python engine.
 *
 * OFFICIAL MODEL PARITY (not automated here): comparing top moves / full
 * distributions against `maia3-uci --model maia3-5m` with the same history
 * mode (repeated current board) and temperature=0 requires the Python stack
 * and the PyTorch checkpoint. Run that offline when changing the encoder.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION, getLegalMoves } from "@/domain/game/rules";
import { fromVocabUci, tokenizeFen, toVocabUci } from "@/engines/maia/encode";
import structuralFixture from "@/engines/maia/fixtures/structural-parity.json";
import { applyLegalMask, legalMovesMask } from "@/engines/maia/mask";
import { sampleFromLogits } from "@/engines/maia/sample";
import {
  getAllPossibleMoves,
  MOVE_VOCAB_SIZE,
  moveToIndex,
} from "@/engines/maia/vocabulary";

describe("Maia structural parity fixtures", () => {
  it("matches documented vocabulary landmarks", () => {
    expect(getAllPossibleMoves()).toHaveLength(MOVE_VOCAB_SIZE);
    for (const [uci, index] of Object.entries(structuralFixture.moveIndices)) {
      expect(moveToIndex(uci)).toBe(index);
    }
  });

  it("matches startpos occupied square/channel pairs", () => {
    const tokens = tokenizeFen(DEFAULT_POSITION);
    for (const entry of structuralFixture.startposOccupied) {
      const square = entry[0] as string;
      const channel = entry[1] as number;
      const sq = "abcdefgh".indexOf(square[0]!) + (Number(square[1]) - 1) * 8;
      expect(tokens[sq * 12 + channel]).toBe(1);
    }
  });

  it("temperature=0 never selects an illegal move on a synthetic policy", () => {
    const fen = DEFAULT_POSITION;
    const mask = legalMovesMask(fen);
    const logits = new Float64Array(MOVE_VOCAB_SIZE);
    logits.fill(-1e9);
    // Boost an illegal quiet null move and a legal e2e4.
    logits[0] = 100; // a1a1 typically illegal
    const e2e4 = moveToIndex("e2e4")!;
    logits[e2e4] = 10;
    const masked = applyLegalMask(logits, mask);
    const idx = sampleFromLogits(masked, { temperature: 0, topP: 1 });
    const vocab = getAllPossibleMoves()[idx]!;
    const boardUci = fromVocabUci(fen, vocab);
    expect(getLegalMoves(fen).some((m) => m.uci === boardUci)).toBe(true);
    expect(boardUci).toBe("e2e4");
    expect(toVocabUci(fen, boardUci)).toBe("e2e4");
  });
});
