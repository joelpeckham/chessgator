import { describe, expect, it } from "vitest";
import { namedAttackers, namedUnitAt } from "@/domain/analysis/board-units";
import { detectForks, detectPins } from "@/domain/analysis/motifs";
import {
  collectMoveEffects,
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

  it("stores defender counts on hanging units", () => {
    const beforeQ =
      "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(beforeQ, "g7g6")!;
    const ignore = tryApplyMove(g6.fenAfter, "a2a3")!;
    const effects = collectMoveEffects({
      fenBefore: g6.fenAfter,
      move: ignore.move,
      fenAfter: ignore.fenAfter,
    });
    const queenThreat = effects.ignoredThreats.find(
      (t) => t.piece.square === "h5",
    );
    expect(queenThreat?.defenderCount).toBeDefined();
    expect(queenThreat?.defenders).toBeDefined();
  });

  it("flags a fianchetto and a pawn break", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const g3 = tryApplyMove(start, "g2g3")!;
    const e5 = tryApplyMove(g3.fenAfter, "e7e5")!;
    const bg2 = tryApplyMove(e5.fenAfter, "f1g2")!;
    const fianchetto = collectMoveEffects({
      fenBefore: e5.fenAfter,
      move: bg2.move,
      fenAfter: bg2.fenAfter,
    });
    expect(fianchetto.fianchetto).toBe(true);

    const qg = "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2";
    const c4 = tryApplyMove(qg, "c2c4")!;
    const brk = collectMoveEffects({
      fenBefore: qg,
      move: c4.move,
      fenAfter: c4.fenAfter,
    });
    expect(brk.pawnBreak).toBe(true);
  });

  it("flags a zwischenzug when a check skips the recapture", () => {
    const previous = tryApplyMove(
      "4k3/8/8/2bp4/8/4N3/8/4K3 w - - 0 1",
      "e3d5",
    )!;
    const bb4 = tryApplyMove(previous.fenAfter, "c5b4")!;
    const effects = collectMoveEffects({
      fenBefore: previous.fenAfter,
      move: bb4.move,
      fenAfter: bb4.fenAfter,
      previousMove: previous.move,
    });
    expect(effects.zwischenzug).toBe(true);
    expect(effects.isRecapture).toBe(false);
  });

  it("flags blocking check separately from fleeing with the king", () => {
    const blockFen = "4k3/8/8/2b5/8/8/8/4R2K b - - 0 1";
    const be7 = tryApplyMove(blockFen, "c5e7")!;
    const blocked = collectMoveEffects({
      fenBefore: blockFen,
      move: be7.move,
      fenAfter: be7.fenAfter,
    });
    expect(blocked.blockedCheck).toBe(true);
    expect(blocked.escapedCheck).toBe(false);

    const fleeFen = "4k3/8/8/8/8/8/8/4R2K b - - 0 1";
    const kf8 = tryApplyMove(fleeFen, "e8f8")!;
    const fled = collectMoveEffects({
      fenBefore: fleeFen,
      move: kf8.move,
      fenAfter: kf8.fenAfter,
    });
    expect(fled.escapedCheck).toBe(true);
    expect(fled.blockedCheck).toBe(false);
    expect(fled.retreatedToSafety).toBe(false);
  });

  it("flags a pawn kick of the queen", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(fen, "g7g6")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: g6.move,
      fenAfter: g6.fenAfter,
    });
    expect(effects.kickedEnemy?.type).toBe("q");
  });

  it("distinguishes creating a passer from pushing one", () => {
    const createFen = "8/8/4p3/3P4/8/8/8/4K2k w - - 0 1";
    const take = tryApplyMove(createFen, "d5e6")!;
    const created = collectMoveEffects({
      fenBefore: createFen,
      move: take.move,
      fenAfter: take.fenAfter,
    });
    expect(created.createdPassedPawn?.square).toBe("e6");
    expect(created.pushedPassedPawn).toBeNull();

    const pushFen = "8/8/4P3/8/8/8/8/4K2k w - - 0 1";
    const e7 = tryApplyMove(pushFen, "e6e7")!;
    const pushed = collectMoveEffects({
      fenBefore: pushFen,
      move: e7.move,
      fenAfter: e7.fenAfter,
    });
    expect(pushed.pushedPassedPawn?.square).toBe("e7");
    expect(pushed.createdPassedPawn).toBeNull();
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
