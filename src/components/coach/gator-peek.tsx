import Image from "next/image";
import type { CSSProperties } from "react";
import {
  type GatorExpression,
  gatorSrc,
} from "@/components/coach/gator-expression";
import {
  CLAWS_SRC,
  clawsLayerStyle,
  GATOR_ART_SCALE,
  GATOR_CLAWS,
  GATOR_LEDGE_OVERLAP_PX,
  gatorDisplaySize,
  NECK_BLEED_PX,
} from "@/components/coach/gator-layout";
import { cn } from "@/lib/utils";

export type GatorPeekProps = {
  expression: GatorExpression;
  scale?: number;
  className?: string;
  style?: CSSProperties;
  /** Hover wiggle on the head only — claws stay planted on the ledge. */
  wiggle?: boolean;
  priority?: boolean;
  /**
   * When false, the root is in-flow and sized to the head so a parent can
   * own absolute placement (e.g. a motion wrapper).
   */
  positioned?: boolean;
  /** Render head, claws, or both. Split so they can animate independently. */
  layers?: "all" | "head" | "claws";
};

/**
 * Gator head tucked under a following sibling ledge, with claws overlapping
 * the edge. The ledge must be `relative z-10` with an opaque background.
 */
export function GatorPeek({
  expression,
  scale = GATOR_ART_SCALE,
  className,
  style,
  wiggle = false,
  priority = false,
  positioned = true,
  layers = "all",
}: GatorPeekProps) {
  const head = gatorDisplaySize(expression, scale);
  const claws = clawsLayerStyle(expression, head.height, scale);

  return (
    <div
      className={cn(
        positioned ? "absolute" : "relative",
        wiggle && "gator-wiggle-group",
        className,
      )}
      style={{
        ...(positioned
          ? { bottom: `calc(100% - ${GATOR_LEDGE_OVERLAP_PX}px)` }
          : undefined),
        ...style,
      }}
      data-testid="gator-peek"
      data-expression={expression}
      data-hands={GATOR_CLAWS[expression].hands}
    >
      <div
        className={cn("relative", wiggle && "gator-wiggle")}
        style={{ width: head.width, height: head.height }}
      >
        {layers !== "claws" ? (
          <>
            <Image
              src={gatorSrc(expression)}
              alt=""
              width={Math.round(head.width)}
              height={Math.round(head.height)}
              className="block h-full w-full select-none"
              draggable={false}
              priority={priority}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-full block overflow-hidden"
              style={{ height: NECK_BLEED_PX }}
            >
              <Image
                src={gatorSrc(expression)}
                alt=""
                width={Math.round(head.width)}
                height={Math.round(head.height)}
                className="block w-full -scale-y-100 select-none"
                style={{ height: head.height }}
                draggable={false}
              />
            </span>
          </>
        ) : null}
      </div>
      {layers !== "head" ? (
        <Image
          src={CLAWS_SRC}
          alt=""
          width={Math.round(claws.width)}
          height={Math.round(claws.height)}
          className="pointer-events-none absolute left-1/2 z-20 max-w-none select-none"
          style={{
            ...claws,
            top: claws.top - GATOR_LEDGE_OVERLAP_PX,
          }}
          draggable={false}
          priority={priority}
        />
      ) : null}
    </div>
  );
}
