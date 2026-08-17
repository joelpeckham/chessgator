import { describe, expect, it } from "vitest";
import { popularOpenings } from "@/app/openings/data";

describe("popularOpenings", () => {
  it("resolves every curated prefix to a dataset opening", () => {
    const popular = popularOpenings();
    expect(popular.length).toBeGreaterThanOrEqual(40);
    expect(new Set(popular.map((opening) => opening.slug)).size).toBe(
      popular.length,
    );
  });
});
