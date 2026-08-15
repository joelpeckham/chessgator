import Image from "next/image";
import Link from "next/link";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { gatorSrc } from "@/components/coach/gator-expression";
import { GATOR_ART } from "@/components/coach/gator-layout";
import { buttonVariants } from "@/components/ui/button";

const SCALE = 0.72;
const sadArt = GATOR_ART.sad;
const sadWidth = Math.round(sadArt.width * SCALE);
const sadHeight = Math.round(sadArt.height * SCALE);

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center border-b border-border px-3 sm:px-4">
        <ChessgatorWordmark />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Image
          src={gatorSrc("sad")}
          alt=""
          width={sadWidth}
          height={sadHeight}
          className="gator-wiggle select-none"
          priority
        />
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-pretty">
          That square isn&apos;t on the board.
        </h1>
        <Link className={buttonVariants()} href="/game">
          Back to the board
        </Link>
      </main>
    </div>
  );
}
