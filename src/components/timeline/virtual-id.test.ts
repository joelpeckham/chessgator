import { describe, expect, it } from "vitest";
import {
  parseVirtualTimelineId,
  virtualId,
} from "@/components/timeline/virtual-id";

describe("virtual timeline ids", () => {
  it("round-trips a tutor path", () => {
    const id = virtualId("tutor", "root-1", "e2e4/e7e5");
    expect(parseVirtualTimelineId(id)).toEqual({
      kind: "tutor",
      rootNodeId: "root-1",
      uciPath: ["e2e4", "e7e5"],
    });
  });

  it("returns null for real node ids", () => {
    expect(parseVirtualTimelineId("node-123")).toBeNull();
  });
});
