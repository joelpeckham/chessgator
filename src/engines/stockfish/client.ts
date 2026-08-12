import type {
  AnalysisEvidence,
  AnalysisPriority,
} from "@/domain/analysis/types";
import { stockfishAssetWorkerUrl } from "@/engines/stockfish/assets";
import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import { PriorityQueue } from "@/engines/stockfish/queue";
import {
  createDefaultStockfishTransport,
  type StockfishTransport,
} from "@/engines/stockfish/transport";

export type AnalyzeOptions = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  priority?: AnalysisPriority;
  multipv?: number;
  movetimeMs?: number;
  /** Wall-clock timeout including queue wait; defaults to movetime + buffer. */
  timeoutMs?: number;
};

export type StockfishClientOptions = {
  transport?: StockfishTransport;
  /** Override engine asset URL (tests / custom hosting). */
  engineUrl?: string;
  /** Default movetime for analyze(). */
  defaultMovetimeMs?: number;
  /** Extra ms added to movetime for the client-side timeout. */
  timeoutBufferMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

type PendingJob = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  multipv: number;
  movetimeMs: number;
  timeoutMs: number;
  resolve: (evidence: AnalysisEvidence) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
};

export type StockfishClientStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "disposed"
  | "failed";

/**
 * Promise-based Stockfish façade: one priority queue, cancellation, timeouts,
 * and stale-result filtering by request / game-node id.
 */
export class StockfishClient {
  private readonly transport: StockfishTransport;
  private readonly engineUrl: string;
  private readonly defaultMovetimeMs: number;
  private readonly timeoutBufferMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private readonly queue = new PriorityQueue<PendingJob>();
  private readonly pending = new Map<string, PendingJob>();
  private readonly timeoutHandles = new Map<string, unknown>();

  private statusValue: StockfishClientStatus = "idle";
  private initPromise: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private active: PendingJob | null = null;
  private currentGameNodeId: string | null = null;
  private generation = 0;
  private cancelInitialization: ((error: Error) => void) | null = null;

  constructor(options: StockfishClientOptions = {}) {
    this.transport = options.transport ?? createDefaultStockfishTransport();
    this.engineUrl = options.engineUrl ?? stockfishAssetWorkerUrl();
    this.defaultMovetimeMs = options.defaultMovetimeMs ?? 250;
    this.timeoutBufferMs = options.timeoutBufferMs ?? 1_500;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    this.unsubscribe = this.transport.subscribe((msg) =>
      this.onWorkerMessage(msg),
    );
  }

  status(): StockfishClientStatus {
    return this.statusValue;
  }

  /** Mark which game node is "current" so stale results are ignored. */
  setCurrentGameNodeId(gameNodeId: string | null): void {
    this.currentGameNodeId = gameNodeId;
  }

  async initialize(): Promise<void> {
    if (this.statusValue === "ready") return;
    if (this.statusValue === "disposed") {
      throw new Error("StockfishClient is disposed");
    }
    if (this.initPromise) return this.initPromise;

    this.statusValue = "initializing";
    this.initPromise = new Promise<void>((resolve, reject) => {
      const requestId = `init-${this.generation++}`;
      const resources: {
        timer?: unknown;
        unsubscribe: (() => void) | null;
      } = { unsubscribe: null };
      let settled = false;

      const cleanup = (): boolean => {
        if (settled) return false;
        settled = true;
        if (resources.timer !== undefined) {
          this.clearTimer(resources.timer);
        }
        resources.unsubscribe?.();
        if (this.cancelInitialization === cancel) {
          this.cancelInitialization = null;
        }
        return true;
      };
      const cancel = (error: Error): void => {
        if (!cleanup()) return;
        reject(error);
      };
      const fail = (error: Error): void => {
        if (!cleanup()) return;
        this.statusValue = "failed";
        reject(error);
      };

      resources.unsubscribe = this.transport.subscribe((msg) => {
        if (msg.type === "ready" && msg.requestId === requestId) {
          if (!cleanup()) return;
          this.statusValue = "ready";
          resolve();
        } else if (msg.type === "error" && msg.requestId === requestId) {
          fail(new Error(msg.message));
        }
      });

      this.cancelInitialization = cancel;
      resources.timer = this.setTimer(
        () => fail(new Error("Stockfish init timed out")),
        30_000,
      );

      try {
        this.post({ type: "init", requestId, engineUrl: this.engineUrl });
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    }).finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  analyze(options: AnalyzeOptions): Promise<AnalysisEvidence> {
    if (this.statusValue === "disposed") {
      return Promise.reject(new Error("StockfishClient is disposed"));
    }

    const movetimeMs = options.movetimeMs ?? this.defaultMovetimeMs;
    const timeoutMs = options.timeoutMs ?? movetimeMs + this.timeoutBufferMs;

    return new Promise<AnalysisEvidence>((resolve, reject) => {
      if (this.pending.has(options.requestId)) {
        reject(new Error(`Duplicate requestId: ${options.requestId}`));
        return;
      }

      const job: PendingJob = {
        requestId: options.requestId,
        gameNodeId: options.gameNodeId,
        fen: options.fen,
        multipv: options.multipv ?? 3,
        movetimeMs,
        timeoutMs,
        resolve,
        reject,
        cancelled: false,
      };

      this.pending.set(job.requestId, job);
      this.queue.enqueue(job.requestId, options.priority ?? "background", job);

      this.armTimeout(job);
      void this.initialize()
        .then(() => this.pump())
        .catch((err: unknown) => {
          this.failJob(
            job,
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    });
  }

  /**
   * Cancel a request. Removes it from the queue or asks the worker to stop
   * if it is currently running. The promise rejects immediately; the worker
   * slot stays busy until `cancelled` / late `result` arrives so searches
   * never overlap on the single-thread engine.
   */
  cancel(requestId: string): void {
    const job = this.pending.get(requestId);
    if (!job || job.cancelled) return;
    job.cancelled = true;
    this.queue.remove(requestId);

    const isActive = this.active?.requestId === requestId;
    if (isActive) {
      this.post({ type: "cancel", requestId });
    }

    this.failJob(job, new Error(`Analysis cancelled: ${requestId}`), {
      // Keep the active slot until the nested engine reports bestmove/cancelled.
      releaseActive: !isActive,
    });
  }

  /** Cancel every pending/active job (e.g. on navigation). */
  cancelAll(): void {
    for (const id of Array.from(this.pending.keys())) {
      this.cancel(id);
    }
  }

  async dispose(): Promise<void> {
    if (this.statusValue === "disposed") return;
    this.statusValue = "disposed";
    this.cancelAll();
    this.cancelInitialization?.(
      new Error(
        "Stockfish initialization cancelled because the client was disposed",
      ),
    );
    const requestId = `dispose-${this.generation++}`;
    await new Promise<void>((resolve) => {
      const timer = this.setTimer(() => resolve(), 1_000);
      const off = this.transport.subscribe((msg) => {
        if (msg.type === "disposed" && msg.requestId === requestId) {
          this.clearTimer(timer);
          off();
          resolve();
        }
      });
      this.post({ type: "dispose", requestId });
    });
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.transport.terminate();
    this.statusValue = "disposed";
  }

  /** Test helper: queue order of request ids. */
  queuedRequestIds(): string[] {
    return this.queue.idsInOrder();
  }

  private post(message: StockfishWorkerRequest): void {
    this.transport.postMessage(message);
  }

  private pump(): void {
    if (this.statusValue !== "ready" || this.active) return;
    const next = this.queue.dequeue();
    if (!next) return;
    const job = next.payload;
    if (job.cancelled) {
      this.pump();
      return;
    }
    this.active = job;
    this.post({
      type: "analyze",
      requestId: job.requestId,
      gameNodeId: job.gameNodeId,
      fen: job.fen,
      multipv: job.multipv,
      movetimeMs: job.movetimeMs,
    });
  }

  private onWorkerMessage(msg: StockfishWorkerResponse): void {
    if (msg.type === "result") {
      this.onResult(msg.requestId, msg.gameNodeId, msg.evidence);
      return;
    }
    if (msg.type === "cancelled") {
      const job = this.pending.get(msg.requestId);
      if (job) {
        this.failJob(job, new Error(`Analysis cancelled: ${msg.requestId}`));
      } else {
        this.releaseActive(msg.requestId);
      }
      return;
    }
    if (msg.type === "error") {
      const job = this.pending.get(msg.requestId);
      if (job) {
        this.failJob(job, new Error(msg.message));
      } else {
        this.releaseActive(msg.requestId);
      }
    }
  }

  private onResult(
    requestId: string,
    gameNodeId: string,
    evidence: AnalysisEvidence,
  ): void {
    const job = this.pending.get(requestId);

    if (!job) {
      // Already cancelled/timed out — free the engine slot and continue.
      this.releaseActive(requestId);
      return;
    }

    if (job.cancelled) {
      this.failJob(job, new Error(`Analysis cancelled: ${requestId}`));
      return;
    }

    if (
      this.currentGameNodeId !== null &&
      gameNodeId !== this.currentGameNodeId
    ) {
      this.failJob(
        job,
        new Error(
          `Stale analysis ignored for node ${gameNodeId} (current ${this.currentGameNodeId})`,
        ),
      );
      return;
    }

    this.clearTimeout(requestId);
    this.pending.delete(requestId);
    this.releaseActive(requestId);
    job.resolve(evidence);
  }

  private armTimeout(job: PendingJob): void {
    const handle = this.setTimer(() => {
      if (!this.pending.has(job.requestId) || job.cancelled) return;
      job.cancelled = true;
      this.queue.remove(job.requestId);
      const isActive = this.active?.requestId === job.requestId;
      if (isActive) {
        this.post({ type: "cancel", requestId: job.requestId });
      }
      this.failJob(
        job,
        new Error(`Analysis timed out after ${job.timeoutMs}ms`),
        { releaseActive: !isActive },
      );
    }, job.timeoutMs);
    this.timeoutHandles.set(job.requestId, handle);
  }

  private clearTimeout(requestId: string): void {
    const handle = this.timeoutHandles.get(requestId);
    if (handle !== undefined) {
      this.clearTimer(handle);
      this.timeoutHandles.delete(requestId);
    }
  }

  private releaseActive(requestId: string): void {
    if (this.active?.requestId === requestId) {
      this.active = null;
      this.pump();
    }
  }

  private failJob(
    job: PendingJob,
    error: Error,
    options: { releaseActive?: boolean } = {},
  ): void {
    const releaseActive = options.releaseActive ?? true;
    if (!this.pending.has(job.requestId)) {
      if (releaseActive) this.releaseActive(job.requestId);
      return;
    }
    this.clearTimeout(job.requestId);
    this.pending.delete(job.requestId);
    job.reject(error);
    if (releaseActive) {
      this.releaseActive(job.requestId);
    }
  }
}
