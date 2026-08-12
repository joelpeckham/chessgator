export type ExternalStore<TState> = {
  getState: () => TState;
  subscribe: (listener: () => void) => () => void;
  setState: (partial: Partial<TState>) => void;
  replace: (next: TState) => void;
};

/** Subscribe/get/emit store for session-style objects (not React state). */
export function createExternalStore<TState>(
  initial: TState,
): ExternalStore<TState> {
  const listeners = new Set<() => void>();
  let state = initial;

  function emit(): void {
    for (const listener of listeners) listener();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState(partial) {
      state = { ...state, ...partial };
      emit();
    },
    replace(next) {
      state = next;
      emit();
    },
  };
}

export type StartGate = {
  readonly generation: number;
  readonly disposed: boolean;
  readonly startPromise: Promise<boolean> | null;
  isCurrent: (gen: number) => boolean;
  run: (
    alreadyReady: boolean,
    work: (gen: number) => Promise<boolean>,
  ) => Promise<boolean>;
  beginDispose: () => number;
  isDisposeCurrent: (gen: number) => boolean;
};

/**
 * Dedupes overlapping `start()` calls and invalidates in-flight work on dispose.
 */
export function createStartGate(): StartGate {
  let generation = 0;
  let disposed = false;
  let startPromise: Promise<boolean> | null = null;

  return {
    get generation() {
      return generation;
    },
    get disposed() {
      return disposed;
    },
    get startPromise() {
      return startPromise;
    },
    isCurrent(gen) {
      return !disposed && gen === generation;
    },
    run(alreadyReady, work) {
      if (alreadyReady) return Promise.resolve(true);
      if (startPromise) return startPromise;
      disposed = false;
      generation += 1;
      const gen = generation;
      startPromise = work(gen).finally(() => {
        if (gen === generation) startPromise = null;
      });
      return startPromise;
    },
    beginDispose() {
      disposed = true;
      generation += 1;
      startPromise = null;
      return generation;
    },
    isDisposeCurrent(gen) {
      return disposed && gen === generation;
    },
  };
}
