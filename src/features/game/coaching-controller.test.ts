import { describe, expect, it, vi } from "vitest";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { tryApplyMove } from "@/domain/game/rules";
import { createCoachingController } from "@/features/game/coaching-controller";
import {
  createStubAnalysisEngine,
  type StockfishClientLike,
} from "@/features/game/stub-analysis";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function createSlowEngine(gate: Promise<void>): StockfishClientLike {
  return {
    status: () => "ready",
    initialize: async () => {},
    setCurrentGameNodeId: () => {},
    cancel: () => {},
    cancelAll: () => {},
    dispose: async () => {},
    analyze: async (opts) => {
      await gate;
      return {
        requestId: opts.requestId,
        gameNodeId: opts.gameNodeId,
        fen: opts.fen,
        sideToMove: "w",
        score: { cp: 0 },
        bestMoveUci: "e2e4",
        lines: [{ multipv: 1, score: { cp: 0 }, pvUci: ["e2e4"] }],
      } satisfies AnalysisEvidence;
    },
  };
}

function stubCoach() {
  return createCoachingController({
    createEngine: () => createStubAnalysisEngine({ delayMs: 0 }),
  });
}

describe("coaching controller", () => {
  it("analyzes a player move into evidence + insight", async () => {
    const coach = stubCoach();
    expect(await coach.start()).toBe(true);

    const applied = tryApplyMove(START, "e2e4")!;
    const evidence = await coach.analyzePlayerMove({
      requestId: "c1",
      gameNodeId: "node-e4",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.classification).toBe("best");
    expect(coach.getState().insight?.concept).toBe("best_move");
    await coach.dispose();
  });

  it("ignores stale analysis after cancel / newer request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const coach = createCoachingController({
      createEngine: () => createSlowEngine(gate),
    });
    await coach.start();
    const applied = tryApplyMove(START, "e2e4")!;

    const pending = coach.analyzePlayerMove({
      requestId: "stale",
      gameNodeId: "node-a",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });

    coach.cancelPending();
    expect(coach.getState().phase).toBe("ready");
    coach.clearFeedback();
    release();

    await expect(pending).resolves.toBeNull();
    expect(coach.getState().insight).toBeNull();
    expect(coach.getState().phase).toBe("ready");
    await coach.dispose();
  });

  it("cancelPending leaves analyzing as ready without stuck UI", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const coach = createCoachingController({
      createEngine: () => createSlowEngine(gate),
    });
    await coach.start();
    const applied = tryApplyMove(START, "e2e4")!;
    const pending = coach.analyzePlayerMove({
      requestId: "mid",
      gameNodeId: "node-a",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });
    expect(coach.getState().phase).toBe("analyzing");

    coach.cancelPending();
    expect(coach.getState().phase).toBe("ready");
    expect(coach.getState().evidence).toBeNull();
    expect(coach.getState().insight).toBeNull();

    release();
    await expect(pending).resolves.toBeNull();
    expect(coach.getState().phase).toBe("ready");
    await coach.dispose();
  });

  it("clearFeedback never preserves a stuck analyzing phase", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const coach = createCoachingController({
      createEngine: () => createSlowEngine(gate),
    });
    await coach.start();
    const applied = tryApplyMove(START, "e2e4")!;
    const pending = coach.analyzePlayerMove({
      requestId: "clear-mid",
      gameNodeId: "node-old",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });
    expect(coach.getState().phase).toBe("analyzing");

    coach.clearFeedback();
    expect(coach.getState().phase).toBe("ready");
    expect(coach.getState().evidence).toBeNull();
    expect(coach.getState().insight).toBeNull();

    release();
    await expect(pending).resolves.toBeNull();
    expect(coach.getState().phase).toBe("ready");
    await coach.dispose();
  });

  it("after clearFeedback, Explore cannot target a prior analyzed node", async () => {
    const coach = stubCoach();
    await coach.start();
    const applied = tryApplyMove(START, "e2e4")!;
    await coach.analyzePlayerMove({
      requestId: "explore-stale",
      gameNodeId: "node-e4",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });
    expect(coach.getState().evidence?.gameNodeId).toBe("node-e4");
    expect(coach.getState().insight?.lineUci.length).toBeGreaterThan(0);

    // Timeline jump / undo clears feedback so Explore has no stale target.
    coach.clearFeedback();
    const after = coach.getState();
    expect(after.phase).toBe("ready");
    expect(after.evidence).toBeNull();
    expect(after.insight).toBeNull();
    await coach.dispose();
  });

  it("autoExpand insights annotate the suggested move on the board", async () => {
    const afterA3 = "rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1";
    const coach = createCoachingController({
      createEngine: () =>
        createStubAnalysisEngine({
          delayMs: 0,
          scripts: [
            {
              fen: START,
              evidence: {
                score: { cp: 40 },
                bestMoveUci: "e2e4",
                lines: [
                  { multipv: 1, score: { cp: 40 }, pvUci: ["e2e4", "e7e5"] },
                  { multipv: 2, score: { cp: -80 }, pvUci: ["a2a3"] },
                ],
              },
            },
            {
              fen: afterA3,
              evidence: {
                // Large White-eval drop so classification auto-expands.
                score: { cp: -180 },
                bestMoveUci: "e7e5",
                lines: [{ multipv: 1, score: { cp: -180 }, pvUci: ["e7e5"] }],
              },
            },
          ],
        }),
    });
    await coach.start();
    const applied = tryApplyMove(START, "a2a3")!;
    expect(applied.fenAfter.startsWith(afterA3.split(" ")[0]!)).toBe(true);
    await coach.analyzePlayerMove({
      requestId: "annotate",
      gameNodeId: "n",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });

    const insight = coach.getState().insight;
    expect(insight?.autoExpand).toBe(true);
    expect(coach.getState().annotations.arrows.length).toBeGreaterThan(0);
    await coach.dispose();
  });

  it("escalates progressive hints", async () => {
    const coach = stubCoach();
    await coach.start();
    const h0 = await coach.escalateHint({
      fen: START,
      gameNodeId: "root",
      sideToMove: "w",
    });
    expect(h0?.level).toBe(0);
    expect(h0?.question.length).toBeGreaterThan(0);

    const h1 = await coach.escalateHint({
      fen: START,
      gameNodeId: "root",
      sideToMove: "w",
    });
    expect(h1?.level).toBe(1);
    expect(h1?.highlightSquares.length).toBeGreaterThan(0);
    await coach.dispose();
  });

  it("clears stale insight when a new analysis starts", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    let call = 0;
    const engine: StockfishClientLike = {
      status: () => "ready",
      initialize: async () => {},
      setCurrentGameNodeId: () => {},
      cancel: () => {},
      cancelAll: () => {},
      dispose: async () => {},
      analyze: async (opts) => {
        call += 1;
        if (call > 2) await gate;
        return {
          requestId: opts.requestId,
          gameNodeId: opts.gameNodeId,
          fen: opts.fen,
          sideToMove: "w",
          score: { cp: 0 },
          bestMoveUci: "e2e4",
          lines: [{ multipv: 1, score: { cp: 0 }, pvUci: ["e2e4"] }],
        } satisfies AnalysisEvidence;
      },
    };

    const coach = createCoachingController({ createEngine: () => engine });
    await coach.start();
    const first = tryApplyMove(START, "e2e4")!;
    await coach.analyzePlayerMove({
      requestId: "first",
      gameNodeId: "n1",
      fenBefore: START,
      fenAfter: first.fenAfter,
      playedMove: first.move,
    });
    expect(coach.getState().insight).not.toBeNull();

    const second = tryApplyMove(first.fenAfter, "e7e5")!;
    const pending = coach.analyzePlayerMove({
      requestId: "second",
      gameNodeId: "n2",
      fenBefore: first.fenAfter,
      fenAfter: second.fenAfter,
      playedMove: second.move,
    });
    expect(coach.getState().phase).toBe("analyzing");
    expect(coach.getState().insight).toBeNull();
    expect(coach.getState().evidence).toBeNull();
    release();
    await pending;
    await coach.dispose();
  });

  it("clearFeedback resets takeback/retry UI state", async () => {
    const coach = stubCoach();
    await coach.start();
    const applied = tryApplyMove(START, "e2e4")!;
    await coach.analyzePlayerMove({
      requestId: "retry",
      gameNodeId: "n",
      fenBefore: START,
      fenAfter: applied.fenAfter,
      playedMove: applied.move,
    });
    expect(coach.getState().insight).not.toBeNull();
    const spy = vi.fn<() => void>();
    coach.subscribe(spy);
    coach.clearFeedback();
    expect(coach.getState().insight).toBeNull();
    expect(coach.getState().phase).toBe("ready");
    expect(coach.getState().annotations.arrows).toEqual([]);
    expect(spy).toHaveBeenCalled();
    await coach.dispose();
  });

  it("ignores a superseded init failure after Strict Mode cleanup", async () => {
    let rejectStale!: (error: Error) => void;
    const staleInit = new Promise<void>((_resolve, reject) => {
      rejectStale = reject;
    });
    const staleEngine = createStubAnalysisEngine({ delayMs: 0 });
    staleEngine.initialize = () => staleInit;
    let createCount = 0;
    const coach = createCoachingController({
      createEngine: () => {
        createCount += 1;
        return createCount === 1
          ? staleEngine
          : createStubAnalysisEngine({ delayMs: 0 });
      },
    });

    const staleStart = coach.start();
    await coach.dispose();
    await expect(coach.start()).resolves.toBe(true);

    rejectStale(new Error("Stockfish init timed out"));
    await expect(staleStart).resolves.toBe(false);
    expect(coach.getState()).toMatchObject({
      phase: "ready",
      message: "Coach ready",
    });
    await coach.dispose();
  });

  it("start succeeds after dispose (Strict Mode cleanup)", async () => {
    const coach = stubCoach();

    await coach.dispose();
    expect(await coach.start()).toBe(true);
    expect(coach.getState().phase).toBe("ready");
    await coach.dispose();
  });

  it("drops a stale future projection after the node changes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const coach = createCoachingController({
      createEngine: () => createSlowEngine(gate),
    });
    await coach.start();

    const stale = coach.projectFuture({
      fen: START,
      gameNodeId: "node-old",
    });
    coach.clearFuture();
    const next = coach.projectFuture({
      fen: START,
      gameNodeId: "node-new",
    });
    release();
    await expect(stale).resolves.toBeNull();
    await next;
    expect(coach.getState().futureNodeId).toBe("node-new");
    expect(coach.getState().futureLine).not.toBeNull();
    await coach.dispose();
  });
});
