import {
  ANALYSIS_PRIORITY_RANK,
  type AnalysisPriority,
} from "@/domain/analysis/types";

export type QueuedJob<T> = {
  id: string;
  priority: AnalysisPriority;
  /** Monotonic sequence for FIFO within the same priority. */
  enqueuedAt: number;
  payload: T;
};

/**
 * Single priority queue: user analysis before background work.
 * Stable FIFO among equal priorities via `enqueuedAt`.
 */
export class PriorityQueue<T> {
  private seq = 0;
  private items: QueuedJob<T>[] = [];

  get size(): number {
    return this.items.length;
  }

  enqueue(id: string, priority: AnalysisPriority, payload: T): QueuedJob<T> {
    const job: QueuedJob<T> = {
      id,
      priority,
      enqueuedAt: this.seq++,
      payload,
    };
    this.items.push(job);
    this.items.sort(compareJobs);
    return job;
  }

  peek(): QueuedJob<T> | undefined {
    return this.items[0];
  }

  dequeue(): QueuedJob<T> | undefined {
    return this.items.shift();
  }

  /** Remove a job by id. Returns true if it was still queued. */
  remove(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter((j) => j.id !== id);
    return this.items.length !== before;
  }

  has(id: string): boolean {
    return this.items.some((j) => j.id === id);
  }

  clear(): void {
    this.items = [];
  }

  /** Test helper: ids in current dequeue order. */
  idsInOrder(): string[] {
    return this.items.map((j) => j.id);
  }
}

function compareJobs<T>(a: QueuedJob<T>, b: QueuedJob<T>): number {
  const rank =
    ANALYSIS_PRIORITY_RANK[a.priority] - ANALYSIS_PRIORITY_RANK[b.priority];
  if (rank !== 0) return rank;
  return a.enqueuedAt - b.enqueuedAt;
}
