import { describe, expect, it } from "vitest";
import { parsePgn } from "@/domain/game/pgn-import";

const OPERA_PGN = `
[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick & Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
`;

describe("parsePgn", () => {
  it("returns null for empty or non-PGN text", () => {
    expect(parsePgn("")).toBeNull();
    expect(parsePgn("   \n")).toBeNull();
    expect(parsePgn("this is not a game")).toBeNull();
  });

  it("parses Opera Game headers and seventeen mating plies", () => {
    const parsed = parsePgn(OPERA_PGN);
    expect(parsed).not.toBeNull();
    expect(parsed?.headers.White).toBe("Morphy, Paul");
    expect(parsed?.headers.Result).toBe("1-0");
    expect(parsed?.moves).toHaveLength(33);
    expect(parsed?.moves[0]).toMatchObject({
      san: "e4",
      uci: "e2e4",
    });
    expect(parsed?.moves[0]?.fenAfter).toContain("4P3");
    expect(parsed?.moves.at(-1)).toMatchObject({
      san: "Rd8#",
      uci: "d1d8",
    });
    expect(parsed?.moves.at(-1)?.fenAfter.split(" ")[1]).toBe("b");
  });

  it("parses a short miniature with UCI promotions omitted", () => {
    const parsed = parsePgn("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#");
    expect(parsed).not.toBeNull();
    expect(parsed?.moves.map((move) => move.san)).toEqual([
      "e4",
      "e5",
      "Qh5",
      "Nc6",
      "Bc4",
      "Nf6",
      "Qxf7#",
    ]);
    expect(parsed?.moves[2]).toMatchObject({ san: "Qh5", uci: "d1h5" });
    expect(parsed?.moves.at(-1)?.uci).toBe("h5f7");
  });

  it("accepts a header-only PGN with no moves", () => {
    const parsed = parsePgn('[White "Morphy"]\n[Black "NN"]\n[Result "*"]\n');
    expect(parsed?.moves).toEqual([]);
    expect(parsed?.headers.White).toBe("Morphy");
    expect(parsed?.headers.Black).toBe("NN");
    expect(parsed?.headers.Result).toBe("*");
  });

  it("ignores NAGs and comments when reading the mainline", () => {
    const parsed = parsePgn("1. e4 {best by test} e5 $1 2. Nf3 *");
    expect(parsed?.moves.map((move) => move.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(parsed?.moves[1]?.fenAfter).toMatch(/^rnbqkbnr\/pppp1ppp/);
  });
});
