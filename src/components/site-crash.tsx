"use client";

import Link from "next/link";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { gatorPeekLiftPx } from "@/components/coach/gator-layout";
import { GatorPeek } from "@/components/coach/gator-peek";
import { Button, buttonVariants } from "@/components/ui/button";

const SCALE = 0.72;
const EXPRESSION = "sad" as const;
const lift = gatorPeekLiftPx(EXPRESSION, SCALE);

export function SiteCrash({
  title,
  onRetry,
}: {
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center border-b border-border px-3 sm:px-4">
        <ChessgatorWordmark href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="relative w-full max-w-sm" style={{ marginTop: lift }}>
          <GatorPeek
            expression={EXPRESSION}
            scale={SCALE}
            wiggle
            priority
            className="left-[18%]"
          />
          <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-6 py-8 shadow-lg">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-pretty">
              {title}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {onRetry ? (
                <Button type="button" onClick={onRetry}>
                  Try again
                </Button>
              ) : null}
              <Link
                className={buttonVariants({
                  variant: onRetry ? "outline" : "default",
                })}
                href="/game"
              >
                Back to the board
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
