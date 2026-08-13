import { describe, expect, it } from "vitest";
import { pickQuip, QUIP_BANK } from "@/domain/teaching/quip-bank";

const CLASSIFICATIONS = [
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
] as const;

const CANONICAL: Record<(typeof CLASSIFICATIONS)[number], string> = {
  best: "That's the one.",
  excellent: "Nice.",
  good: "Solid.",
  inaccuracy: "There's better.",
  mistake: "That was shaky.",
  blunder: "Want to look at that?",
};

describe("QUIP_BANK", () => {
  it("has 100 unique short lines per classification", () => {
    for (const key of CLASSIFICATIONS) {
      const lines = QUIP_BANK[key];
      expect(lines).toHaveLength(100);
      expect(lines[0]).toBe(CANONICAL[key]);
      const normalized = lines.map((line) => line.trim().toLowerCase());
      expect(new Set(normalized).size).toBe(100);
      for (const line of lines) {
        expect(line).toBe(line.trim());
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(48);
        expect(line).toMatch(/[.?!]$/);
        expect(line).not.toMatch(/—/);
        const words = line.split(/\s+/);
        expect(words.length).toBeGreaterThanOrEqual(1);
        expect(words.length).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("pickQuip", () => {
  it("returns the canonical line without a seed", () => {
    expect(pickQuip("best", undefined)).toBe("That's the one.");
    expect(pickQuip("blunder", undefined)).toBe("Want to look at that?");
  });

  it("picks a stable in-bank variant for a seed", () => {
    const a = pickQuip("best", "node-1");
    const b = pickQuip("best", "node-1");
    expect(a).toBe(b);
    expect(QUIP_BANK.best).toContain(a);
    expect(pickQuip("best", "node-2")).toBe(pickQuip("best", "node-2"));
  });
});
