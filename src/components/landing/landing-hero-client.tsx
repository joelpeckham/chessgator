"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { StaticBoard } from "@/components/board/static-board";
import { GatorPeek } from "@/components/coach/gator-peek";
import { HERO_GATOR_SCALE, HeroFrame } from "@/components/landing/hero-frame";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_POSITION } from "@/domain/game";
import { LandingHeroDemo } from "@/features/landing/landing-hero";
import { HERO_INTRO_COPY } from "@/features/landing/use-hero-demo";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * Server-renderable stand-in: same frame, static SVG board, resting gator.
 * Crawlers and no-JS visitors see the position; hydration swaps in the demo.
 */
function HeroPlaceholder() {
  return (
    <HeroFrame
      gator={
        <GatorPeek
          expression="neutral-happy"
          scale={HERO_GATOR_SCALE}
          className="left-[12%]"
          priority
        />
      }
      board={
        <StaticBoard
          fen={DEFAULT_POSITION}
          title="Chess starting position — your move"
          labels={false}
          className="board-checkered aspect-square w-full max-w-none"
        />
      }
      coach={
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Coach</h3>
          <p className="text-xs text-muted-foreground">{HERO_INTRO_COPY}</p>
        </div>
      }
      actions={
        <>
          <Link className={buttonVariants({ size: "lg" })} href="/game">
            Play on the full board
          </Link>
          <Link
            className={buttonVariants({ variant: "outline", size: "lg" })}
            href="/play/beginner"
          >
            Start at beginner
          </Link>
        </>
      }
    />
  );
}

/** Sole landing components → features bridge (see game-shell-client). */
export function LandingHeroClient() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );

  return mounted ? <LandingHeroDemo /> : <HeroPlaceholder />;
}
