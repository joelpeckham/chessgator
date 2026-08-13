import { describe, expect, it } from "vitest";
import type { GameMove } from "@/domain/game/types";
import {
  describeBecause,
  describeMove,
  describePlayedProblem,
} from "@/domain/teaching/move-copy";

function move(
  partial: Partial<GameMove> & Pick<GameMove, "from" | "to" | "piece">,
): GameMove {
  return {
    san: partial.san ?? "x",
    uci: partial.uci ?? `${partial.from}${partial.to}`,
    color: partial.color ?? "w",
    captured: partial.captured,
    promotion: partial.promotion,
    ...partial,
  };
}

describe("describeMove", () => {
  it("names pawn pushes in plain English", () => {
    expect(
      describeMove(
        move({ from: "h2", to: "h4", piece: "p", san: "h4", uci: "h2h4" }),
      ),
    ).toBe("moving your pawn to h4");
  });

  it("describes pawn captures by the capturing file, not SAN guesswork", () => {
    expect(
      describeMove(
        move({
          from: "e4",
          to: "d5",
          piece: "p",
          captured: "n",
          san: "exd5",
          uci: "e4d5",
        }),
      ),
    ).toBe("taking the knight on d5 with your e-pawn");
    expect(
      describeMove(
        move({
          from: "e4",
          to: "d5",
          piece: "p",
          captured: "n",
          san: "exd5",
          uci: "e4d5",
        }),
      ),
    ).not.toMatch(/h-pawn|h4 pawn/i);
  });

  it("describes kingside castling", () => {
    expect(
      describeMove(
        move({ from: "e1", to: "g1", piece: "k", san: "O-O", uci: "e1g1" }),
      ),
    ).toBe("castling kingside");
  });

  it("describes a knight move", () => {
    expect(
      describeMove(
        move({ from: "g2", to: "h4", piece: "n", san: "Nh4", uci: "g2h4" }),
      ),
    ).toBe("moving your knight to h4");
  });
});

describe("describePlayedProblem", () => {
  it("names the attacking piece", () => {
    const played = move({ from: "g2", to: "h4", piece: "n", san: "Nh4" });
    expect(
      describePlayedProblem(
        {
          kind: "hanging",
          piece: { type: "n", color: "w", square: "h4" },
          attackers: [{ type: "q", color: "b", square: "d8" }],
        },
        played,
      ),
    ).toBe("puts it at risk of attack from the black queen");
  });
});

describe("describeBecause", () => {
  it("joins a likely capture and pin", () => {
    expect(
      describeBecause(
        [
          {
            kind: "capture",
            captured: { type: "n", color: "b", square: "d5" },
            likely: true,
          },
          {
            kind: "pin",
            pinned: { type: "n", color: "b", square: "c6" },
            target: { type: "k", color: "b", square: "e8" },
            likely: true,
          },
        ],
        "w",
      ),
    ).toBe(
      "you can likely take a knight and then pin another knight to the king",
    );
  });

  it("explains castling", () => {
    expect(describeBecause([{ kind: "castle", side: "kingside" }], "w")).toBe(
      "it gets your king out of danger and activates your rook",
    );
  });

  it("falls back to a verified positional claim", () => {
    expect(describeBecause([{ kind: "center_control" }], "w")).toBe(
      "you control more central squares",
    );
  });
});
