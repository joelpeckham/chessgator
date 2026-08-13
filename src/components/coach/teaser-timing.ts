export const TEASER_VISIBLE_MS = 5_000;
export const IDLE_HINT_DELAY_MS = 30_000;
export const IDLE_HINT_QUIP = "Tap the gator to get a hint.";

export function isIdleHintEligible(input: {
  firstHumanTurn: boolean;
  playerTurn: boolean;
  hasInsight: boolean;
  hasHint: boolean;
}): boolean {
  return (
    input.firstHumanTurn &&
    input.playerTurn &&
    !input.hasInsight &&
    !input.hasHint
  );
}

export function scheduleIdleHint(
  eligible: boolean,
  onShow: () => void,
  delayMs = IDLE_HINT_DELAY_MS,
): (() => void) | undefined {
  if (!eligible) return undefined;
  const id = setTimeout(onShow, delayMs);
  return () => clearTimeout(id);
}

export function scheduleTeaserExpiry(
  teaserKey: string | null,
  onExpire: () => void,
  durationMs = TEASER_VISIBLE_MS,
): (() => void) | undefined {
  if (!teaserKey) return undefined;
  const id = setTimeout(onExpire, durationMs);
  return () => clearTimeout(id);
}
