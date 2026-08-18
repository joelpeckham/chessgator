import type { CSSProperties, ReactNode } from "react";
import { preload } from "react-dom";
import {
  type GatorExpression,
  gatorSrc,
} from "@/components/coach/gator-expression";
import { gatorPeekLiftPx } from "@/components/coach/gator-layout";
import { cn } from "@/lib/utils";

/** Landing gator scale; smaller than the text-only hero so the board leads. */
export const HERO_GATOR_SCALE = 0.55;

const HERO_EXPRESSIONS: readonly GatorExpression[] = [
  "neutral-happy",
  "sad",
  "mischievous",
  "shocked",
  "confused",
  "scared",
];

/** Room above the card for the tallest face, so moods never shift layout. */
export const HERO_GATOR_LIFT_PX = Math.ceil(
  Math.max(
    ...HERO_EXPRESSIONS.map((expression) =>
      gatorPeekLiftPx(expression, HERO_GATOR_SCALE),
    ),
  ),
);

export type HeroFrameProps = {
  /** Absolutely-positioned gator peeking over the card ledge. */
  gator: ReactNode;
  board: ReactNode;
  coach: ReactNode;
  /** Engine / result status line; keeps its slot to avoid layout shift. */
  notice?: string | null;
  actions: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Shared card shell for the playable hero: board on top, coach strip below,
 * CTAs at the bottom, with the gator ledge above. Used by both the
 * server-rendered placeholder and the live demo so hydration doesn't jump.
 */
export function HeroFrame({
  gator,
  board,
  coach,
  notice = null,
  actions,
  className,
  style,
}: HeroFrameProps) {
  // Warm every face so an expression swap never paints a blank frame.
  for (const expression of HERO_EXPRESSIONS) {
    preload(gatorSrc(expression), { as: "image" });
  }

  return (
    <div
      className={cn("relative w-full max-w-xl", className)}
      style={{ marginTop: HERO_GATOR_LIFT_PX, ...style }}
      data-testid="hero-frame"
    >
      {gator}
      <div className="relative z-10 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-5">
        {board}
        <div className="min-h-16 rounded-xl border border-border bg-background/70 px-4 py-3 text-left">
          {coach}
        </div>
        <p
          className="min-h-5 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      </div>
    </div>
  );
}
