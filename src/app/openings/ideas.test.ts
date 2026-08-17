import { describe, expect, it } from "vitest";
import { OPENINGS } from "./data";
import { openingDescription } from "./ideas";

describe("openingDescription", () => {
  it("keeps every opening meta description at a SERP-friendly length", () => {
    for (const opening of OPENINGS) {
      expect(openingDescription(opening).length).toBeLessThanOrEqual(155);
    }
  });
});
