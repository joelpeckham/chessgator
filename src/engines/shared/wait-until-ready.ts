export type WaitUntilReadyOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type WaitUntilReady = {
  readonly ready: boolean;
  wait: () => Promise<void>;
  signalReady: () => void;
  signalError: (error: Error) => void;
  reset: () => void;
};

/**
 * Promise resolved by a later ready/error signal, with a per-waiter timeout.
 * Replaces `while (!ready) await sleep(25)` loops in engine workers.
 */
export function createWaitUntilReady(
  options: WaitUntilReadyOptions = {},
): WaitUntilReady {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const timeoutMessage =
    options.timeoutMessage ?? "Timed out waiting until ready";
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let ready = false;
  let error: Error | null = null;
  const waiters: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  function settleOk(): void {
    ready = true;
    error = null;
    const pending = waiters.splice(0);
    for (const waiter of pending) waiter.resolve();
  }

  function settleErr(err: Error): void {
    ready = false;
    error = err;
    const pending = waiters.splice(0);
    for (const waiter of pending) waiter.reject(err);
  }

  return {
    get ready() {
      return ready;
    },
    wait() {
      if (ready) return Promise.resolve();
      if (error) return Promise.reject(error);
      return new Promise<void>((resolve, reject) => {
        const timer = setTimer(() => {
          const idx = waiters.indexOf(entry);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error(timeoutMessage));
        }, timeoutMs);
        const entry = {
          resolve: () => {
            clearTimer(timer);
            resolve();
          },
          reject: (err: Error) => {
            clearTimer(timer);
            reject(err);
          },
        };
        waiters.push(entry);
      });
    },
    signalReady() {
      settleOk();
    },
    signalError(err) {
      settleErr(err);
    },
    reset() {
      ready = false;
      error = null;
      const pending = waiters.splice(0);
      const cancelled = new Error("Ready wait cancelled");
      for (const waiter of pending) waiter.reject(cancelled);
    },
  };
}
