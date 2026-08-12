import type { FeedbackNotice } from "@/components/coach/feedback-stack";
import type { SessionMode } from "@/domain/game";
import type { MaiaSessionPhase } from "@/features/game/maia-session";

const HIGH_SIGNAL_NAV =
  /resumed|new game|undid|trying|could not|loaded finished|corrupt/i;

export type FeedbackNoticeInput = {
  engineNoticeArmed: boolean;
  enginesWarming: boolean;
  dismissedIds: ReadonlySet<string>;
  maiaPhase: MaiaSessionPhase;
  maiaMessage: string | null;
  mode: SessionMode;
  errorHeadline: string;
  errorDetail: string | null;
  navMessage: string | null;
};

export function isHighSignalNavMessage(message: string): boolean {
  return HIGH_SIGNAL_NAV.test(message);
}

/** Assemble the floating toast stack from engine/nav status. */
export function buildFeedbackNotices(
  input: FeedbackNoticeInput,
): FeedbackNotice[] {
  const notices: FeedbackNotice[] = [];
  if (
    input.engineNoticeArmed &&
    input.enginesWarming &&
    !input.dismissedIds.has("engine-loading") &&
    input.maiaPhase !== "failed"
  ) {
    notices.push({
      id: "engine-loading",
      title: "Downloading engines…",
      body: input.maiaMessage ?? "You can move — Maia will reply when ready.",
      busy: true,
      dismissible: true,
    });
  }
  if (input.maiaPhase === "failed" || input.mode === "error") {
    notices.push({
      id: "engine-error",
      title: input.errorHeadline,
      body: input.errorDetail,
      variant: "destructive",
      dismissible: false,
    });
  } else if (
    input.navMessage &&
    !input.dismissedIds.has("nav") &&
    isHighSignalNavMessage(input.navMessage)
  ) {
    notices.push({
      id: "nav",
      title: input.navMessage,
      dismissible: true,
    });
  }
  return notices;
}
