import { describe, expect, it } from "vitest";
import { buildFeedbackNotices } from "@/features/game/notices";

describe("buildFeedbackNotices", () => {
  it("shows a delayed engine-loading toast while engines warm", () => {
    const notices = buildFeedbackNotices({
      engineNoticeArmed: true,
      enginesWarming: true,
      dismissedIds: new Set(),
      maiaPhase: "starting",
      maiaMessage: "Loading Maia…",
      mode: "playerTurn",
      errorHeadline: "Your move",
      errorDetail: null,
      navMessage: null,
    });
    expect(notices).toEqual([
      {
        id: "engine-loading",
        title: "Downloading engines…",
        body: "Loading Maia…",
        busy: true,
        dismissible: true,
      },
    ]);
  });

  it("keeps only high-signal navigation toasts", () => {
    const resumed = buildFeedbackNotices({
      engineNoticeArmed: false,
      enginesWarming: false,
      dismissedIds: new Set(),
      maiaPhase: "ready",
      maiaMessage: null,
      mode: "playerTurn",
      errorHeadline: "Your move",
      errorDetail: null,
      navMessage: "Resumed local game",
    });
    expect(resumed[0]?.id).toBe("nav");

    const review = buildFeedbackNotices({
      engineNoticeArmed: false,
      enginesWarming: false,
      dismissedIds: new Set(),
      maiaPhase: "ready",
      maiaMessage: null,
      mode: "reviewing",
      errorHeadline: "Reviewing",
      errorDetail: null,
      navMessage: "Reviewing move 4",
    });
    expect(review).toEqual([]);

    const corrupt = buildFeedbackNotices({
      engineNoticeArmed: false,
      enginesWarming: false,
      dismissedIds: new Set(),
      maiaPhase: "ready",
      maiaMessage: null,
      mode: "playerTurn",
      errorHeadline: "Your move",
      errorDetail: null,
      navMessage: "Saved game was corrupt and could not be restored",
    });
    expect(corrupt[0]?.id).toBe("nav");
  });

  it("surfaces engine failure as a non-dismissible error", () => {
    const notices = buildFeedbackNotices({
      engineNoticeArmed: false,
      enginesWarming: false,
      dismissedIds: new Set(),
      maiaPhase: "failed",
      maiaMessage: "Maia failed to start",
      mode: "error",
      errorHeadline: "Maia failed to start",
      errorDetail: "Check the model assets.",
      navMessage: "Resumed local game",
    });
    expect(notices).toEqual([
      {
        id: "engine-error",
        title: "Maia failed to start",
        body: "Check the model assets.",
        variant: "destructive",
        dismissible: false,
      },
    ]);
  });
});
