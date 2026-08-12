import type {
  OpponentEngine,
  OpponentEngineStatus,
  OpponentMoveRequest,
  OpponentMoveResult,
} from "@/engines/shared/opponent";
import {
  MaiaClient,
  type MaiaClientOptions,
} from "@/engines/maia/client";
import { validateLegalUci } from "@/engines/maia/validate-move";

export type MaiaOpponentOptions = MaiaClientOptions & {
  client?: MaiaClient;
};

/**
 * Maia-backed opponent implementing the shared `OpponentEngine` contract.
 * UI chooses Stockfish fallback when status is `failed`.
 */
export class MaiaOpponent implements OpponentEngine {
  readonly id = "maia-opponent";
  readonly source = "maia" as const;

  private readonly client: MaiaClient;
  private ownsClient: boolean;
  private failed = false;

  constructor(options: MaiaOpponentOptions = {}) {
    this.ownsClient = !options.client;
    this.client = options.client ?? new MaiaClient(options);
  }

  status(): OpponentEngineStatus {
    if (this.failed) return "failed";
    const s = this.client.status();
    if (s === "idle") return "idle";
    if (s === "downloading") return "downloading";
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
      const result = await this.client.infer({
        requestId: request.requestId,
        gameNodeId: request.gameNodeId,
        fen: request.fen,
        historyFens: request.historyFens,
        selfElo: request.selfElo,
        oppoElo: request.oppoElo,
        temperature: request.temperature,
        topP: request.topP,
        timeoutMs: request.movetimeMs
          ? request.movetimeMs + 5_000
          : undefined,
      });

      const moveUci = validateLegalUci(request.fen, result.moveUci);
      if (!moveUci) {
        throw new Error(
          `Maia returned an illegal or missing move for ${request.fen}: ${result.moveUci}`,
        );
      }

      return {
        requestId: request.requestId,
        gameNodeId: request.gameNodeId,
        moveUci,
        source: "maia",
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
