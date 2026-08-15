import { describe, expect, it } from "vitest";
import {
  parseVirtualTimelineId,
  virtualId,
} from "@/components/timeline/virtual-id";

describe("virtual timeline ids", () => {
  it("round-trips a suggested move", () => {
    const id = virtualId("root-1", "e2e4");
    expect(parseVirtualTimelineId(id)).toEqual({
      kind: "suggested",
      rootNodeId: "root-1",
      uci: "e2e4",
    });
  });

  it("returns null for real node ids", () => {
    expect(parseVirtualTimelineId("node-123")).toBeNull();
  });
});
