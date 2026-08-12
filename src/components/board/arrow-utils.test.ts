import { describe, expect, it } from "vitest";
import { dedupeBoardArrows } from "@/components/board/arrow-utils";

describe("board arrow utils", () => {
  it("keeps one arrow per route and lets later entries override color", () => {
    expect(
      dedupeBoardArrows([
        { from: "e2", to: "e4", color: "blue" },
        { from: "e2", to: "e4", color: "green" },
        { from: "g1", to: "f3", color: "red" },
      ]),
    ).toEqual([
      { from: "e2", to: "e4", color: "green" },
      { from: "g1", to: "f3", color: "red" },
    ]);
  });
});
