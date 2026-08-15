export type EngineJob<TResult> = {
  requestId: string;
  gameNodeId: string;
  timeoutMs: number;
  cancelled: boolean;
  resolve: (result: TResult) => void;
  reject: (error: Error) => void;
};

export type EngineJobBookHooks<TResult, TJob extends EngineJob<TResult>> = {
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  removeFromQueue: (requestId: string) => void;
  postCancel: (requestId: string) => void;
  afterReleaseActive: () => void;
  cancelMessage: (requestId: string) => string;
  timeoutMessage: (job: TJob) => string;
  staleMessage: (gameNodeId: string, current: string) => string;
  /** How long to wait for a worker cancel/result ack before freeing the slot. */
  cancelAckTimeoutMs?: number;
  onUnresponsive?: (requestId: string) => void;
};

/**
 * Shared pending-job lifecycle for engine clients: timeouts, cancellation,
 * stale game-node filtering, and the single active slot.
 */
export class EngineJobBook<TResult, TJob extends EngineJob<TResult>> {
  readonly pending = new Map<string, TJob>();
  active: TJob | null = null;
  currentGameNodeId: string | null = null;
  generation = 0;

  private readonly timeoutHandles = new Map<string, unknown>();
  private readonly cancelAckHandles = new Map<string, unknown>();

  constructor(private readonly hooks: EngineJobBookHooks<TResult, TJob>) {}

  nextGeneration(): number {
    const current = this.generation;
    this.generation += 1;
    return current;
  }

  setCurrentGameNodeId(gameNodeId: string | null): void {
    this.currentGameNodeId = gameNodeId;
  }

  track(job: TJob): void {
    this.pending.set(job.requestId, job);
    this.armTimeout(job);
  }

  cancel(requestId: string): void {
    const job = this.pending.get(requestId);
    if (!job || job.cancelled) return;
    this.abort(job, new Error(this.hooks.cancelMessage(requestId)));
  }

  cancelAll(): void {
    for (const id of Array.from(this.pending.keys())) {
      this.cancel(id);
    }
  }

  /** Returns the job when the result is still current; otherwise settles it. */
  takeResult(requestId: string, gameNodeId: string): TJob | null {
    const job = this.pending.get(requestId);
    if (!job) {
      this.releaseActive(requestId);
      return null;
    }
    if (job.cancelled) {
      this.fail(job, new Error(this.hooks.cancelMessage(requestId)));
      return null;
    }
    if (
      this.currentGameNodeId !== null &&
      gameNodeId !== this.currentGameNodeId
    ) {
      this.fail(
        job,
        new Error(this.hooks.staleMessage(gameNodeId, this.currentGameNodeId)),
      );
      return null;
    }
    this.clearTimeout(requestId);
    this.pending.delete(requestId);
    this.releaseActive(requestId);
    return job;
  }

  handleCancelled(requestId: string): void {
    const job = this.pending.get(requestId);
    if (job) {
      this.fail(job, new Error(this.hooks.cancelMessage(requestId)));
    } else {
      this.releaseActive(requestId);
    }
  }

  handleError(requestId: string, message: string): boolean {
    const job = this.pending.get(requestId);
    if (job) {
      this.fail(job, new Error(message));
      return true;
    }
    this.releaseActive(requestId);
    return false;
  }

  fail(
    job: TJob,
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

  releaseActive(requestId: string): void {
    this.clearCancelAck(requestId);
    if (this.active?.requestId === requestId) {
      this.active = null;
      this.hooks.afterReleaseActive();
    }
  }

  private abort(job: TJob, error: Error): void {
    job.cancelled = true;
    this.hooks.removeFromQueue(job.requestId);
    const isActive = this.active?.requestId === job.requestId;
    if (isActive) {
      this.hooks.postCancel(job.requestId);
      this.armCancelAck(job.requestId);
    }
    this.fail(job, error, { releaseActive: !isActive });
  }

  private armTimeout(job: TJob): void {
    const handle = this.hooks.setTimer(() => {
      if (!this.pending.has(job.requestId) || job.cancelled) return;
      this.abort(job, new Error(this.hooks.timeoutMessage(job)));
    }, job.timeoutMs);
    this.timeoutHandles.set(job.requestId, handle);
  }

  private armCancelAck(requestId: string): void {
    this.clearCancelAck(requestId);
    const timeoutMs = this.hooks.cancelAckTimeoutMs ?? 5_000;
    const handle = this.hooks.setTimer(() => {
      this.cancelAckHandles.delete(requestId);
      if (this.active?.requestId !== requestId) return;
      this.releaseActive(requestId);
      this.hooks.onUnresponsive?.(requestId);
    }, timeoutMs);
    this.cancelAckHandles.set(requestId, handle);
  }

  private clearCancelAck(requestId: string): void {
    const handle = this.cancelAckHandles.get(requestId);
    if (handle === undefined) return;
    this.hooks.clearTimer(handle);
    this.cancelAckHandles.delete(requestId);
  }

  private clearTimeout(requestId: string): void {
    const handle = this.timeoutHandles.get(requestId);
    if (handle !== undefined) {
      this.hooks.clearTimer(handle);
      this.timeoutHandles.delete(requestId);
    }
  }
}

export async function handshakeDispose(args: {
  requestId: string;
  postDispose: () => void;
  subscribe: (listener: (isDisposed: boolean) => void) => () => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = args.timeoutMs ?? 1_000;
  await new Promise<void>((resolve) => {
    const timer = args.setTimer(() => resolve(), timeoutMs);
    const off = args.subscribe((isDisposed) => {
      if (!isDisposed) return;
      args.clearTimer(timer);
      off();
      resolve();
    });
    args.postDispose();
  });
}
