import { describe, expect, it } from "vitest";
import type { GameMove } from "@/domain/game/types";
import {
  describeBecause,
  describeMove,
  describePlayedProblem,
  describeRefutationPunchline,
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
          seeCp: 900,
          defenderCount: 0,
        },
        played,
      ),
    ).toMatch(/black queen/);
  });

  it("names a SEE exchange loss instead of a generic hanging", () => {
    const played = move({ from: "a1", to: "a8", piece: "r", san: "Ra8" });
    expect(
      describePlayedProblem(
        {
          kind: "hanging",
          piece: { type: "r", color: "w", square: "a8" },
          attackers: [{ type: "b", color: "b", square: "c6" }],
          seeCp: 200,
          defenderCount: 0,
        },
        played,
      ),
    ).toMatch(/lose the exchange/i);
  });

  it("names the chased piece when a pawn can kick it", () => {
    const played = move({ from: "d1", to: "h5", piece: "q", san: "Qh5" });
    expect(
      describePlayedProblem(
        {
          kind: "kicked_by_pawn",
          piece: { type: "q", color: "w", square: "h5" },
          attackers: [{ type: "p", color: "b", square: "g6" }],
        },
        played,
      ),
    ).toBe("puts your queen where a pawn can chase it");
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
            pinner: { type: "r", color: "w", square: "e1" },
          },
        ],
        "w",
      ),
    ).toBe(
      "you can likely take a knight and then you pin another knight to the king",
    );
  });

  it("explains castling", () => {
    expect(describeBecause([{ kind: "castle", side: "kingside" }], "w")).toBe(
      "it gets your king out of danger and activates your rook",
    );
  });

  it("varies center-control copy by seed but keeps the canonical phrasing without one", () => {
    expect(describeBecause([{ kind: "center_control" }], "w")).toBe(
      "you control more central squares",
    );
    const a = describeBecause([{ kind: "center_control" }], "w", {
      seed: "node-a",
    });
    const b = describeBecause([{ kind: "center_control" }], "w", {
      seed: "node-b",
    });
    expect(a).toMatch(/center|central/);
    expect(b).toMatch(/center|central/);
    expect(
      new Set([a, b, "you control more central squares"]).size,
    ).toBeGreaterThan(1);
  });

  it("saves a piece from its origin square, never the destination", () => {
    expect(
      describeBecause(
        [
          {
            kind: "saves_piece",
            piece: { type: "b", color: "w", square: "a6" },
            origin: "a6",
          },
        ],
        "w",
      ),
    ).toMatch(/saves your bishop from a6/);
    expect(
      describeBecause(
        [
          {
            kind: "saves_piece",
            piece: { type: "b", color: "w", square: "a6" },
            origin: "a6",
          },
        ],
        "w",
      ),
    ).not.toMatch(/c4-bishop|c8-bishop|from c8|from c4/);
  });

  it("names a hanging bishop as a bishop, not a knight", () => {
    const played = move({ from: "c1", to: "f4", piece: "b", san: "Bf4" });
    expect(
      describePlayedProblem(
        {
          kind: "hanging",
          piece: { type: "b", color: "w", square: "f4" },
          attackers: [{ type: "p", color: "b", square: "e5" }],
          seeCp: 300,
          defenderCount: 0,
        },
        played,
      ),
    ).toMatch(/a bishop/);
    expect(
      describePlayedProblem(
        {
          kind: "hanging",
          piece: { type: "b", color: "w", square: "f4" },
          attackers: [{ type: "p", color: "b", square: "e5" }],
          seeCp: 300,
          defenderCount: 0,
        },
        played,
      ),
    ).not.toMatch(/knight/);
  });

  it("does not call a defended capture undefended", () => {
    expect(
      describeBecause(
        [
          {
            kind: "wins_material",
            captured: { type: "p", color: "b", square: "e5" },
            seeCp: 100,
            defenderCount: 1,
          },
        ],
        "w",
      ),
    ).toMatch(/attacked more times than it was defended/);
    expect(
      describeBecause(
        [
          {
            kind: "wins_material",
            captured: { type: "p", color: "b", square: "e5" },
            seeCp: 100,
            defenderCount: 1,
          },
        ],
        "w",
      ),
    ).not.toMatch(/undefended/);
  });

  it("says nothing when there is no extra reason", () => {
    expect(describeBecause([], "w")).toBeNull();
  });

  it("does not pair check with a forced-mate reason", () => {
    expect(
      describeBecause(
        [{ kind: "forces_mate", mateIn: 2 }, { kind: "check" }],
        "w",
      ),
    ).toBe("it forces checkmate in 2 moves");
  });

  it("explains a winning capture by SEE instead of restating the take", () => {
    expect(
      describeBecause(
        [
          {
            kind: "wins_material",
            captured: { type: "p", color: "b", square: "d4" },
            seeCp: 100,
            defenderCount: 0,
          },
        ],
        "w",
      ),
    ).toBe("the d4 pawn was undefended");
  });
});

describe("describeRefutationPunchline", () => {
  it("walks a take-and-recapture into a material punchline", () => {
    const played = move({
      from: "d8",
      to: "d4",
      piece: "q",
      color: "b",
      captured: "n",
      san: "Qxd4",
    });
    const recapture = move({
      from: "c3",
      to: "d4",
      piece: "p",
      captured: "q",
      san: "cxd4",
    });
    expect(
      describeRefutationPunchline(
        [
          {
            ply: 0,
            move: played,
            captured: { type: "n", color: "w", square: "d4" },
            capturedSeeCp: 300,
            gaveCheck: false,
            pins: [],
            forks: [],
            skewers: [],
            discovered: [],
            promotion: false,
          },
          {
            ply: 1,
            move: recapture,
            captured: { type: "q", color: "b", square: "d4" },
            capturedSeeCp: 900,
            gaveCheck: false,
            pins: [],
            forks: [],
            skewers: [],
            discovered: [],
            promotion: false,
          },
        ],
        -200,
        "w",
      ),
    ).toMatch(
      /after the black queen takes your knight[\s\S]*recapture[\s\S]*down/i,
    );
  });
});
