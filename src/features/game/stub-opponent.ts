import { getLegalMoves } from "@/domain/game";
import type {
  OpponentEngine,
  OpponentEngineStatus,
  OpponentMoveRequest,
  OpponentMoveResult,
} from "@/engines/shared/opponent";

export type StubOpponentOptions = {
  id?: string;
  source: "maia" | "stockfish";
  /** When true, `initialize` rejects and status becomes `failed`. */
  failInit?: boolean;
  /** Optional fixed UCI replies in order; falls back to first legal move. */
  scriptedMoves?: string[];
  initDelayMs?: number;
  moveDelayMs?: number;
};

/**
 * Deterministic opponent for Playwright / unit tests.
 * Never touches workers or network.
 */
export class StubOpponent implements OpponentEngine {
  readonly id: string;
  readonly source: "maia" | "stockfish";

  private statusValue: OpponentEngineStatus = "idle";
  private readonly failInit: boolean;
  private readonly scriptedMoves: string[];
  private scriptIndex = 0;
  private readonly initDelayMs: number;
  private readonly moveDelayMs: number;
  private cancelled = new Set<string>();

  constructor(options: StubOpponentOptions) {
    this.id = options.id ?? `stub-${options.source}`;
    this.source = options.source;
    this.failInit = options.failInit ?? false;
    this.scriptedMoves = options.scriptedMoves ?? [];
    this.initDelayMs = options.initDelayMs ?? 0;
    this.moveDelayMs = options.moveDelayMs ?? 0;
  }

  status(): OpponentEngineStatus {
    return this.statusValue;
  }

  async initialize(): Promise<void> {
    if (this.statusValue === "ready") return;
    this.statusValue = "downloading";
    if (this.initDelayMs > 0) {
      await delay(this.initDelayMs / 2);
    }
    this.statusValue = "initializing";
    if (this.initDelayMs > 0) {
      await delay(this.initDelayMs / 2);
    }
    if (this.failInit) {
      this.statusValue = "failed";
      throw new Error("Stub Maia failed to initialize");
    }
    this.statusValue = "ready";
  }

  async chooseMove(request: OpponentMoveRequest): Promise<OpponentMoveResult> {
    if (this.statusValue !== "ready") {
      throw new Error(`${this.id} is not ready`);
    }
    if (this.moveDelayMs > 0) {
      await delay(this.moveDelayMs);
    }
    if (this.cancelled.has(request.requestId)) {
      this.cancelled.delete(request.requestId);
      throw new Error(`Cancelled ${request.requestId}`);
    }

    const scripted = this.scriptedMoves[this.scriptIndex];
    let moveUci = scripted;
    if (moveUci) {
      this.scriptIndex += 1;
    } else {
      const legal = getLegalMoves(request.fen);
      if (legal.length === 0) {
        throw new Error(`No legal moves for ${request.fen}`);
      }
      moveUci = legal[0]!.uci;
    }

    return {
      requestId: request.requestId,
      gameNodeId: request.gameNodeId,
      moveUci,
      source: this.source,
    };
  }

  cancel(requestId: string): void {
    this.cancelled.add(requestId);
  }

  async dispose(): Promise<void> {
    this.statusValue = "disposed";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
