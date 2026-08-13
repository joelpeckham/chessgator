import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IDLE_HINT_DELAY_MS,
  IDLE_HINT_QUIP,
  isIdleHintEligible,
  scheduleIdleHint,
  scheduleTeaserExpiry,
  TEASER_VISIBLE_MS,
} from "@/components/coach/teaser-timing";

describe("isIdleHintEligible", () => {
  it("is true only on ply 0 of a playable turn with no coach content", () => {
    expect(
      isIdleHintEligible({
        ply: 0,
        playerTurn: true,
        hasInsight: false,
        hasHint: false,
      }),
    ).toBe(true);
    expect(
      isIdleHintEligible({
        ply: 1,
        playerTurn: true,
        hasInsight: false,
        hasHint: false,
      }),
    ).toBe(false);
    expect(
      isIdleHintEligible({
        ply: 0,
        playerTurn: false,
        hasInsight: false,
        hasHint: false,
      }),
    ).toBe(false);
    expect(
      isIdleHintEligible({
        ply: 0,
        playerTurn: true,
        hasInsight: true,
        hasHint: false,
      }),
    ).toBe(false);
    expect(
      isIdleHintEligible({
        ply: 0,
        playerTurn: true,
        hasInsight: false,
        hasHint: true,
      }),
    ).toBe(false);
  });
});

describe("idle hint and teaser timers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the idle prompt after 30 seconds and not before", () => {
    vi.useFakeTimers();
    const onShow = vi.fn<() => void>();
    const cancel = scheduleIdleHint(true, onShow);
    vi.advanceTimersByTime(IDLE_HINT_DELAY_MS - 1);
    expect(onShow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onShow).toHaveBeenCalledTimes(1);
    cancel?.();
  });

  it("does not schedule when ineligible", () => {
    vi.useFakeTimers();
    const onShow = vi.fn<() => void>();
    expect(scheduleIdleHint(false, onShow)).toBeUndefined();
    vi.advanceTimersByTime(IDLE_HINT_DELAY_MS);
    expect(onShow).not.toHaveBeenCalled();
  });

  it("cancels a pending idle prompt", () => {
    vi.useFakeTimers();
    const onShow = vi.fn<() => void>();
    const cancel = scheduleIdleHint(true, onShow);
    cancel?.();
    vi.advanceTimersByTime(IDLE_HINT_DELAY_MS);
    expect(onShow).not.toHaveBeenCalled();
  });

  it("expires a teaser after 5 seconds", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn<() => void>();
    scheduleTeaserExpiry("praise:best", onExpire);
    vi.advanceTimersByTime(TEASER_VISIBLE_MS - 1);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("keeps the idle prompt copy instructional", () => {
    expect(IDLE_HINT_QUIP).toBe("Tap the gator to get a hint.");
  });
});
