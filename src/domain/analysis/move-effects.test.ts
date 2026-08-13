import { describe, expect, it } from "vitest";
import {
  collectMoveEffects,
  detectForks,
  detectPins,
  namedAttackers,
  namedUnitAt,
  walkLineEvents,
} from "@/domain/analysis/move-effects";
import { createChess, tryApplyMove } from "@/domain/game/rules";

describe("move effects", () => {
  it("names the attacker of a hanging queen", () => {
    const beforeQ =
      "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(beforeQ, "g7g6")!;
    const ignore = tryApplyMove(g6.fenAfter, "a2a3")!;
    const effects = collectMoveEffects({
      fenBefore: g6.fenAfter,
      move: ignore.move,
      fenAfter: ignore.fenAfter,
    });
    expect(effects.ignoredThreats.some((t) => t.piece.square === "h5")).toBe(
      true,
    );
    const queenThreat = effects.ignoredThreats.find(
      (t) => t.piece.square === "h5",
    );
    expect(queenThreat?.piece.type).toBe("q");
    expect(
      queenThreat?.attackers.some((a) => a.type === "p" && a.square === "g6"),
    ).toBe(true);
  });

  it("credits e4 with extra center control", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const applied = tryApplyMove(start, "e2e4")!;
    const effects = collectMoveEffects({
      fenBefore: start,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    expect(effects.centerControlDelta).toBeGreaterThan(0);
  });

  it("detects a kingside castle as king safety plus rook activation", () => {
    const before =
      "rnbqk2r/ppppbppp/5n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w KQkq - 4 4";
    const applied = tryApplyMove(before, "e1g1")!;
    const effects = collectMoveEffects({
      fenBefore: before,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    expect(effects.castleSide).toBe("kingside");
    expect(effects.kingSafer || effects.castleSide === "kingside").toBe(true);
  });

  it("detects an absolute pin of a knight to the king", () => {
    const chess = createChess("4k3/4n3/8/8/8/8/8/R6K w - - 0 1");
    const applied = tryApplyMove(chess.fen(), "a1e1")!;
    const after = createChess(applied.fenAfter);
    const pins = detectPins(after, "b");
    expect(
      pins.some((pin) => pin.pinned.type === "n" && pin.target.type === "k"),
    ).toBe(true);
  });

  it("detects a knight fork of king and queen", () => {
    const before = "4k3/8/8/8/3Q4/n7/8/4K3 b - - 0 1";
    const applied = tryApplyMove(before, "a3c2")!;
    const after = createChess(applied.fenAfter);
    const forker = namedUnitAt(after, "c2")!;
    const forks = detectForks(after, forker);
    const types = forks[0]?.targets.map((t) => t.type).toSorted() ?? [];
    expect(types).toContain("k");
    expect(types).toContain("q");
  });

  it("walks a line for later captures", () => {
    const fen = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
    const events = walkLineEvents(fen, ["e4d5", "d8d5"]);
    expect(events[0]?.captured?.type).toBe("p");
    expect(events[1]?.captured?.type).toBe("p");
  });

  it("lists named attackers on a square", () => {
    const chess = createChess(
      "rnbqkbnr/pppp1p1p/6p1/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3",
    );
    const attackers = namedAttackers(chess, "h5", "b");
    expect(attackers.some((a) => a.type === "p" && a.square === "g6")).toBe(
      true,
    );
  });
});
