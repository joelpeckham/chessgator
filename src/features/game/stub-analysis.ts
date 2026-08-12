import type { AnalysisEvidence } from "@/domain/analysis/types";
import type { StockfishClientLike } from "@/engines/stockfish/ports";

export type {
  CreateAnalysisEngineFn,
  StockfishClientLike,
} from "@/engines/stockfish/ports";

export type StubAnalysisScript = {
  /** Match by fen prefix or exact fen. */
  fen: string;
  evidence: Omit<
    AnalysisEvidence,
    "requestId" | "gameNodeId" | "fen" | "sideToMove"
  > &
    Partial<Pick<AnalysisEvidence, "sideToMove">>;
};

/**
 * Deterministic MultiPV-ish replies for coached-flow Playwright tests.
 * Never touches workers or network.
 */
export function createStubAnalysisEngine(options?: {
  scripts?: StubAnalysisScript[];
  delayMs?: number;
}): StockfishClientLike {
  const scripts = options?.scripts ?? defaultStubScripts();
  const delayMs = options?.delayMs ?? 15;
  let statusValue = "idle";
  let currentNode: string | null = null;
  const cancelled = new Set<string>();

  return {
    status: () => statusValue,
    async initialize() {
      statusValue = "initializing";
      await wait(delayMs);
      statusValue = "ready";
    },
    setCurrentGameNodeId(id) {
      currentNode = id;
    },
    cancel(requestId) {
      cancelled.add(requestId);
    },
    cancelAll() {
      cancelled.clear();
    },
    async dispose() {
      statusValue = "disposed";
    },
    async analyze(opts) {
      if (statusValue !== "ready") {
        throw new Error("Stub analysis engine not ready");
      }
      await wait(delayMs);
      if (cancelled.has(opts.requestId)) {
        cancelled.delete(opts.requestId);
        throw new Error(`Analysis cancelled: ${opts.requestId}`);
      }
      if (currentNode !== null && opts.gameNodeId !== currentNode) {
        throw new Error(
          `Stale analysis ignored for node ${opts.gameNodeId} (current ${currentNode})`,
        );
      }

      const script = scripts.find(
        (s) => opts.fen === s.fen || opts.fen.startsWith(s.fen),
      );
      const side: "w" | "b" = opts.fen.split(" ")[1] === "b" ? "b" : "w";
      const base = script?.evidence ?? {
        score: { cp: side === "w" ? 20 : -20 },
        bestMoveUci: side === "w" ? "e2e4" : "e7e5",
        lines: [
          {
            multipv: 1,
            score: { cp: side === "w" ? 20 : -20 },
            pvUci: [side === "w" ? "e2e4" : "e7e5"],
          },
        ],
      };

      return {
        requestId: opts.requestId,
        gameNodeId: opts.gameNodeId,
        fen: opts.fen,
        sideToMove: base.sideToMove ?? side,
        score: base.score,
        bestMoveUci: base.bestMoveUci,
        ponderUci: base.ponderUci,
        lines: base.lines,
        depth: base.depth ?? 8,
        nodes: base.nodes,
        timeMs: base.timeMs ?? delayMs,
      };
    },
  };
}

function defaultStubScripts(): StubAnalysisScript[] {
  // Starting position — e4 is best.
  const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  // After 1.e4 — Black to move.
  const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
  // After 1.d4 — make d4 a teachable inaccuracy vs e4 (eval drop > 100cp).
  const afterD4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1";
  // Queen sortie position (White to move after …g6): saving the queen is best.
  const queenAttacked =
    "rnbqkbnr/pppp1p1p/6p1/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3";
  const afterIgnore =
    "rnbqkbnr/pppp1p1p/6p1/4p2Q/4P3/P7/1PPP1PPP/RNB1KBNR b KQkq - 0 3";

  return [
    {
      fen: start,
      evidence: {
        score: { cp: 25 },
        bestMoveUci: "e2e4",
        lines: [
          { multipv: 1, score: { cp: 25 }, pvUci: ["e2e4", "e7e5"] },
          { multipv: 2, score: { cp: 20 }, pvUci: ["d2d4"] },
        ],
      },
    },
    {
      fen: afterE4,
      evidence: {
        score: { cp: 30 },
        bestMoveUci: "e7e5",
        lines: [{ multipv: 1, score: { cp: 30 }, pvUci: ["e7e5"] }],
      },
    },
    {
      fen: afterD4,
      evidence: {
        score: { cp: -120 },
        bestMoveUci: "d7d5",
        lines: [{ multipv: 1, score: { cp: -120 }, pvUci: ["d7d5", "c2c4"] }],
      },
    },
    {
      fen: queenAttacked,
      evidence: {
        score: { cp: -150 },
        bestMoveUci: "h5e5",
        lines: [
          { multipv: 1, score: { cp: -40 }, pvUci: ["h5e5", "g8f6"] },
          { multipv: 2, score: { cp: -900 }, pvUci: ["a2a3"] },
        ],
      },
    },
    {
      fen: afterIgnore,
      evidence: {
        score: { cp: -950 },
        bestMoveUci: "g6h5",
        lines: [{ multipv: 1, score: { cp: -950 }, pvUci: ["g6h5"] }],
      },
    },
  ];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
