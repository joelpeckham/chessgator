import { describe, expect, it } from "vitest";
import { createWaitUntilReady } from "@/engines/shared/wait-until-ready";

describe("createWaitUntilReady", () => {
  it("resolves waiters when signaled ready", async () => {
    const gate = createWaitUntilReady({ timeoutMs: 5_000 });
    const pending = gate.wait();
    gate.signalReady();
    await pending;
    expect(gate.ready).toBe(true);
    await gate.wait();
  });

  it("rejects waiters on error and timeout", async () => {
    const timers: Array<() => void> = [];
    const gate = createWaitUntilReady({
      timeoutMs: 50,
      timeoutMessage: "init timed out",
      setTimer: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimer: () => {},
    });
    const timedOut = gate.wait();
    for (const fn of timers) fn();
    await expect(timedOut).rejects.toThrow(/init timed out/);

    const failed = createWaitUntilReady({ timeoutMs: 5_000 });
    const pending = failed.wait();
    failed.signalError(new Error("boom"));
    await expect(pending).rejects.toThrow(/boom/);
    await expect(failed.wait()).rejects.toThrow(/boom/);
  });
});
