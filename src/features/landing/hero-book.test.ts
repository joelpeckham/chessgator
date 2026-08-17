import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSITION,
  getLegalMoves,
  isLegalMove,
  tryApplyMove,
} from "@/domain/game";
import { HERO_BOOK_LINES, pickBookReply } from "@/features/landing/hero-book";

function fenAfterLine(sans: readonly string[]): string {
  let fen = DEFAULT_POSITION;
  for (const san of sans) {
    const applied = tryApplyMove(fen, san);
    if (!applied) throw new Error(`Illegal book move ${san} after ${fen}`);
    fen = applied.fenAfter;
  }
  return fen;
}

describe("hero opening book", () => {
  it("every line replays legally and every reply is legal", () => {
    for (const { line, replies } of HERO_BOOK_LINES) {
      const fen = fenAfterLine(line);
      expect(replies.length).toBeGreaterThan(0);
      const illegal = replies.filter((reply) => !tryApplyMove(fen, reply));
      expect(illegal).toEqual([]);
    }
  });

  it("book lines end after a White move so Black replies", () => {
    const evenLines = HERO_BOOK_LINES.filter(
      ({ line }) => line.length % 2 === 0,
    );
    expect(evenLines).toEqual([]);
  });

  it("returns a legal book reply to 1. e4", () => {
    const fen = fenAfterLine(["e4"]);
    const reply = pickBookReply(fen, () => 0);
    expect(reply).toBe("e7e5");
    expect(reply && isLegalMove(fen, reply)).toBe(true);
  });

  it("picks deterministically from the reply list", () => {
    const fen = fenAfterLine(["e4"]);
    expect(pickBookReply(fen, () => 0.99)).toBe("e7e6");
  });

  it("answers any unlisted first move with ...d5", () => {
    const fen = fenAfterLine(["a3"]);
    expect(pickBookReply(fen, () => 0)).toBe("d7d5");
  });

  it("ignores the clock fields when matching positions", () => {
    const fen = fenAfterLine(["e4"]);
    const withOddClocks = fen.replace(/ \d+ \d+$/, " 3 7");
    expect(pickBookReply(withOddClocks, () => 0)).toBe("e7e5");
  });

  it("returns null when it is not Black's turn", () => {
    expect(pickBookReply(DEFAULT_POSITION)).toBeNull();
  });

  it("returns null once out of book past move one", () => {
    const fen = fenAfterLine(["e4", "e5", "a3"]);
    expect(pickBookReply(fen)).toBeNull();
  });

  it("replies from every book position are moves Black can actually play", () => {
    // Sanity that the book only speaks for Black.
    for (const { line } of HERO_BOOK_LINES) {
      const fen = fenAfterLine(line);
      const reply = pickBookReply(fen, () => 0);
      expect(reply).not.toBeNull();
      const legal = getLegalMoves(fen).map((move) => move.uci);
      expect(legal).toContain(reply);
    }
  });
});
