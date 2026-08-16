import { describe, expect, it } from "vitest";
import {
  isHangingBySee,
  seeGainCp,
  seeGainForCapture,
} from "@/domain/analysis/see";
import { createChess } from "@/domain/game";

describe("seeGainCp", () => {
  it("wins an undefended pawn", () => {
    const chess = createChess("4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1");
    expect(seeGainCp(chess, "d5", "w")).toBe(100);
  });

  it("refuses a queen-for-pawn capture when the recapture wins the queen", () => {
    const chess = createChess("4k3/3p4/8/8/8/8/3Q4/4K3 w - - 0 1");
    expect(seeGainCp(chess, "d7", "w")).toBe(0);
  });

  it("counts a pawn taking a queen even when the queen is 'defended'", () => {
    // Black pawn e5 attacks White queen d4; White knight f3 recaptures.
    const chess = createChess("4k3/8/8/4p3/3Q4/5N2/8/4K3 b - - 0 1");
    expect(seeGainCp(chess, "d4", "b")).toBe(800);
    expect(isHangingBySee(chess, "d4", "w")).toBe(true);
  });

  it("credits an en-passant capture of a free pawn", () => {
    const chess = createChess("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(
      seeGainForCapture(
        chess,
        { from: "e5", to: "d6", piece: "p", color: "w" },
        "d5",
      ),
    ).toBe(100);
  });

  it("treats an equal minor-piece trade as stand-pat zero", () => {
    const chess = createChess("4k3/8/8/3n4/8/4B3/8/4K3 w - - 0 1");
    expect(seeGainCp(chess, "d5", "w")).toBe(0);
    expect(isHangingBySee(chess, "d5", "b")).toBe(false);
  });
});
