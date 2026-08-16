import type { Metadata } from "next";
import Link from "next/link";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { gatorPeekLiftPx } from "@/components/coach/gator-layout";
import { GatorPeek } from "@/components/coach/gator-peek";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/lib/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};

const HERO_SCALE = 0.8;
const HERO_EXPRESSION = "neutral-happy" as const;
const heroLift = gatorPeekLiftPx(HERO_EXPRESSION, HERO_SCALE);

const FEATURES = [
  {
    title: "A human-like opponent",
    body: "You play against Maia, a neural network trained on millions of human games. Pick a strength that matches your level and it makes the kinds of moves people actually make, not cold engine lines.",
  },
  {
    title: "Coaching after every move",
    body: "Stockfish runs after each of your moves. The coach classifies what you played, names the idea behind it, and can show a stronger line. Step back through the game tree and try a different move any time.",
  },
  {
    title: "Private by design",
    body: "There is no account and no server-side analysis. Both engines run in your browser through WebAssembly, and your games stay on your device.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <JsonLd data={jsonLd} />
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
        <ChessgatorWordmark href="/" />
        <Link className={buttonVariants({ size: "sm" })} href="/game">
          Play
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-6 py-16">
        <section className="flex flex-col items-center text-center">
          <div
            className="relative w-full max-w-xl"
            style={{ marginTop: heroLift }}
          >
            <GatorPeek
              expression={HERO_EXPRESSION}
              scale={HERO_SCALE}
              wiggle
              priority
              className="left-[16%]"
            />
            <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-6 py-8 shadow-lg">
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance">
                Learn chess by playing it.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground text-pretty">
                Play against a human-like opponent while a coach explains the
                ideas behind better moves. Everything runs in your browser, and
                nothing leaves your device.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link className={buttonVariants({ size: "lg" })} href="/game">
                  Play now — it&apos;s free
                </Link>
                <Link
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                  href="/about"
                >
                  How it works
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-10 sm:grid-cols-3 sm:gap-6">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="space-y-2">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {feature.title}
              </h2>
              <p className="text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </section>
        <section className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Ready for a game?
          </h2>
          <p className="text-muted-foreground">
            No sign-up. Open the board and make your first move — engines load
            in the browser once.
          </p>
          <Link className={buttonVariants({ size: "lg" })} href="/game">
            Start playing
          </Link>
          <p className="text-sm text-muted-foreground">
            Have questions? Read the{" "}
            <Link
              href="/faq"
              className="text-primary underline-offset-4 hover:underline"
            >
              FAQ
            </Link>
            .
          </p>
        </section>
      </main>
      <footer>
        <SiteFooter />
      </footer>
    </div>
  );
}
