import type {
  OpponentEngine,
  OpponentEngineStatus,
  OpponentMoveRequest,
  OpponentMoveResult,
} from "@/engines/shared/opponent";
import {
  StockfishClient,
  type StockfishClientOptions,
} from "@/engines/stockfish/client";
import { validateLegalUci } from "@/engines/stockfish/validate-move";

export type StockfishOpponentOptions = StockfishClientOptions & {
  client?: StockfishClient;
  defaultMovetimeMs?: number;
};

/**
 * Stockfish-backed opponent used as Maia fallback.
 * Chooses the engine best move after chess.js legal validation.
 */
export class StockfishOpponent implements OpponentEngine {
  readonly id = "stockfish-opponent";
  readonly source = "stockfish" as const;

  private readonly client: StockfishClient;
  private readonly defaultMovetimeMs: number;
  private ownsClient: boolean;
  private failed = false;

  constructor(options: StockfishOpponentOptions = {}) {
    this.ownsClient = !options.client;
    this.client = options.client ?? new StockfishClient(options);
    this.defaultMovetimeMs = options.defaultMovetimeMs ?? 200;
  }

  status(): OpponentEngineStatus {
    if (this.failed) return "failed";
    const s = this.client.status();
    if (s === "idle") return "idle";
    if (s === "initializing") return "initializing";
    if (s === "ready") return "ready";
    if (s === "disposed") return "disposed";
    return "failed";
  }

  async initialize(): Promise<void> {
    try {
      await this.client.initialize();
    } catch (err) {
      this.failed = true;
      throw err;
    }
  }

  async chooseMove(request: OpponentMoveRequest): Promise<OpponentMoveResult> {
    this.client.setCurrentGameNodeId(request.gameNodeId);
    try {
      const evidence = await this.client.analyze({
        requestId: request.requestId,
        gameNodeId: request.gameNodeId,
        fen: request.fen,
        priority: "opponent",
        multipv: 1,
        movetimeMs: request.movetimeMs ?? this.defaultMovetimeMs,
      });

      const moveUci = validateLegalUci(request.fen, evidence.bestMoveUci);
      if (!moveUci) {
        throw new Error(
          `Stockfish returned an illegal or missing move for ${request.fen}: ${evidence.bestMoveUci}`,
        );
      }

      return {
        requestId: request.requestId,
        gameNodeId: request.gameNodeId,
        moveUci,
        source: "stockfish",
      };
    } catch (err) {
      this.failed = this.client.status() === "failed";
      throw err;
    }
  }

  cancel(requestId: string): void {
    this.client.cancel(requestId);
  }

  async dispose(): Promise<void> {
    if (this.ownsClient) {
      await this.client.dispose();
    }
  }
}
