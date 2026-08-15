import { handshakeDispose } from "@/engines/shared/engine-job-book";

export type EngineHandshakeTimers = {
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

export type EngineHandshake = {
  promise: Promise<void>;
  cancel: (error: Error) => void;
};

/**
 * Shared init handshake: subscribe, post, timeout, and settle exactly once.
 */
export function startEngineHandshake<TMsg>(
  args: EngineHandshakeTimers & {
    subscribe: (listener: (msg: TMsg) => void) => () => void;
    post: () => void;
    timeoutMs: number;
    timeoutMessage: string;
    onMessage: (
      msg: TMsg,
      settle: { resolve: () => void; fail: (error: Error) => void },
    ) => void;
  },
): EngineHandshake {
  let settled = false;
  let timer: unknown;
  let unsubscribe: (() => void) | null = null;
  let rejectInit: ((error: Error) => void) | null = null;

  const cleanup = (): boolean => {
    if (settled) return false;
    settled = true;
    if (timer !== undefined) args.clearTimer(timer);
    unsubscribe?.();
    rejectInit = null;
    return true;
  };

  const promise = new Promise<void>((resolve, reject) => {
    rejectInit = reject;
    const fail = (error: Error): void => {
      if (!cleanup()) return;
      reject(error);
    };
    const succeed = (): void => {
      if (!cleanup()) return;
      resolve();
    };

    unsubscribe = args.subscribe((msg) => {
      args.onMessage(msg, { resolve: succeed, fail });
    });
    timer = args.setTimer(
      () => fail(new Error(args.timeoutMessage)),
      args.timeoutMs,
    );

    try {
      args.post();
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return {
    promise,
    cancel(error) {
      const reject = rejectInit;
      if (!cleanup()) return;
      reject?.(error);
    },
  };
}

export async function disposeEngineClient(args: {
  requestId: string;
  postDispose: () => void;
  subscribe: (listener: (isDisposed: boolean) => void) => () => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  unsubscribe: (() => void) | null;
  terminate: () => void;
}): Promise<void> {
  await handshakeDispose({
    requestId: args.requestId,
    postDispose: args.postDispose,
    subscribe: args.subscribe,
    setTimer: args.setTimer,
    clearTimer: args.clearTimer,
  });
  args.unsubscribe?.();
  args.terminate();
}
