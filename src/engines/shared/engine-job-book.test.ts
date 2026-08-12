import { describe, expect, it } from "vitest";
import {
  type EngineJob,
  EngineJobBook,
} from "@/engines/shared/engine-job-book";

type Job = EngineJob<string>;

function createBook() {
  const cancelled: string[] = [];
  const timers = new Map<string, () => void>();
  const book = new EngineJobBook<string, Job>({
    setTimer: (fn) => {
      const id = `t${timers.size}`;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (handle) => {
      timers.delete(handle as string);
    },
    removeFromQueue: () => {},
    postCancel: (requestId) => {
      cancelled.push(requestId);
    },
    afterReleaseActive: () => {},
    cancelMessage: (requestId) => `cancelled ${requestId}`,
    timeoutMessage: (job) => `timed out ${job.requestId}`,
    staleMessage: (gameNodeId, current) =>
      `stale ${gameNodeId} (current ${current})`,
  });
  return { book, cancelled, timers };
}

function pendingJob(
  requestId: string,
  gameNodeId = "n1",
): {
  job: Job;
  result: Promise<string>;
} {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const result = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    job: {
      requestId,
      gameNodeId,
      timeoutMs: 1_000,
      cancelled: false,
      resolve,
      reject,
    },
    result,
  };
}

describe("EngineJobBook", () => {
  it("rejects queued cancel without posting to the worker", async () => {
    const { book, cancelled } = createBook();
    const { job, result } = pendingJob("q1");
    book.track(job);
    book.cancel("q1");
    await expect(result).rejects.toThrow(/cancelled q1/);
    expect(cancelled).toEqual([]);
    expect(book.pending.size).toBe(0);
  });

  it("posts cancel for the active job and keeps the slot until the worker replies", async () => {
    const { book, cancelled } = createBook();
    const { job, result } = pendingJob("a1");
    book.track(job);
    book.active = job;
    book.cancel("a1");
    await expect(result).rejects.toThrow(/cancelled a1/);
    expect(cancelled).toEqual(["a1"]);
    expect(book.active.requestId).toBe("a1");

    book.handleCancelled("a1");
    expect(book.active).toBeNull();
  });

  it("filters stale results by current game node", async () => {
    const { book } = createBook();
    const { job, result } = pendingJob("r1", "old");
    book.track(job);
    book.active = job;
    book.setCurrentGameNodeId("current");
    expect(book.takeResult("r1", "old")).toBeNull();
    await expect(result).rejects.toThrow(/stale old/);
    expect(book.active).toBeNull();
  });

  it("times out a hung job", async () => {
    const { book, timers, cancelled } = createBook();
    const { job, result } = pendingJob("slow");
    book.track(job);
    book.active = job;
    expect(timers.size).toBe(1);
    for (const fn of timers.values()) fn();
    await expect(result).rejects.toThrow(/timed out slow/);
    expect(cancelled).toEqual(["slow"]);
  });
});
