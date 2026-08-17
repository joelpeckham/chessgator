import { describe, expect, it } from "vitest";
import { PLAY_LEVELS, playContentPaths } from "@/app/play/levels";

describe("playContentPaths", () => {
  it("lists only canonical slug URLs", () => {
    const paths = playContentPaths();
    expect(paths).toContain("/play");
    for (const level of PLAY_LEVELS) {
      expect(paths).toContain(`/play/${level.slug}`);
      expect(paths).not.toContain(`/play/${level.elo}`);
    }
  });
});
