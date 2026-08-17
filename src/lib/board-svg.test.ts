import { describe, expect, it } from "vitest";
import { parseFenPlacement, renderBoardSvg } from "@/lib/board-svg";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseFenPlacement", () => {
  it("places the starting army", () => {
    const cells = parseFenPlacement(START);
    expect(cells).toHaveLength(64);
    expect(cells?.find((c) => c.square === "e1")?.piece).toBe("K");
    expect(cells?.find((c) => c.square === "e8")?.piece).toBe("k");
    expect(cells?.find((c) => c.square === "e4")?.piece).toBeNull();
  });

  it("rejects a broken placement field", () => {
    expect(parseFenPlacement("8/8/8/8/8/8/8")).toBeNull();
    expect(parseFenPlacement("not-a-fen")).toBeNull();
  });
});

describe("renderBoardSvg", () => {
  it("emits a self-contained SVG with the given title", () => {
    const svg = renderBoardSvg(START, { title: "Starting position" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("Starting position");
    expect(svg).toContain("\u2654");
  });
});
