import { describe, expect, it } from "vitest";
import { argmax, sampleFromLogits, stableSoftmax } from "@/engines/maia/sample";

describe("Maia sampling", () => {
  it("uses stable softmax", () => {
    const probs = stableSoftmax([1000, 1000, Number.NEGATIVE_INFINITY]);
    expect(probs[0]! + probs[1]!).toBeCloseTo(1, 8);
    expect(probs[2]).toBe(0);
  });

  it("argmax is deterministic and tie-breaks low index", () => {
    expect(argmax([1, 3, 3, 2])).toBe(1);
    expect(argmax([Number.NEGATIVE_INFINITY, 0, -1])).toBe(1);
  });

  it("temperature <= 0 selects argmax (parity / test mode)", () => {
    const logits = [0, 5, 1, Number.NEGATIVE_INFINITY];
    expect(sampleFromLogits(logits, { temperature: 0, topP: 1 })).toBe(1);
    expect(sampleFromLogits(logits, { temperature: -1, topP: 0.5 })).toBe(1);
  });

  it("temperature sampling follows injected RNG", () => {
    const logits = [Number.NEGATIVE_INFINITY, 10, 0];
    // RNG=0 hits the first positive mass (index 1).
    const idx = sampleFromLogits(logits, {
      temperature: 1,
      topP: 1,
      random: () => 0,
    });
    expect(idx).toBe(1);
  });

  it("top-p always keeps the top-1 mass", () => {
    const logits = [0, 10, 9, 0];
    const idx = sampleFromLogits(logits, {
      temperature: 1,
      topP: 0.0001,
      random: () => 0.99,
    });
    expect(idx).toBe(1);
  });
});
