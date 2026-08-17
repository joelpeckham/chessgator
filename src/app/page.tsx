import type { Metadata } from "next";
import Link from "next/link";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { gatorPeekLiftPx } from "@/components/coach/gator-layout";
import { GatorPeek } from "@/components/coach/gator-peek";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
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
    body: "You play against Maia, a neural network trained on millions of human games. Pick a strength from Elo 1100 to 1900 and it makes the kinds of moves people actually make, not cold engine lines.",
  },
  {
    title: "Coaching after every move",
    body: "Stockfish runs after each of your moves. The coach classifies what you played, names the idea behind it, and can show a stronger line. Step back through the game tree and try a different move any time.",
  },
  {
    title: "No account, nothing uploaded",
    body: "There is no sign-up and no server-side analysis. Both engines run in your browser through WebAssembly. The first visit downloads about 30 MB; your games stay on this device.",
  },
] as const;

const COMPARISON = [
  {
    title: "Chess.com",
    body: "Chess.com has personality bots, Game Review, lessons, and human opponents. You need an account, and the deeper coaching tools sit behind a subscription. Games and analysis live on their servers. It is a full platform, not a local coach.",
  },
  {
    title: "Lichess",
    body: "Lichess is free and open source. You can already play Maia bots there, and Stockfish analysis is available after a game. Guest play works; an account saves your history. Use Lichess to play other people, run studies, and solve puzzles.",
  },
  {
    title: "chessgator",
    body: "This site is narrower. Maia is the opponent. Stockfish coaches after every move, not only at the end. There is no account. Engines run in the browser. If you want humans, clubs, or a puzzle trainer, stay on Lichess or Chess.com.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <JsonLd data={jsonLd} />
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
        <ChessgatorWordmark href="/" />
        <div className="flex items-center gap-3">
          <SiteNav className="hidden sm:flex" />
          <Link className={buttonVariants({ size: "sm" })} href="/game">
            Play
          </Link>
        </div>
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
                Play a human-like chess bot. Get a free coach after every move.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground text-pretty">
                Maia plays like a person at Elo 1100–1900. After each of your
                moves, Stockfish classifies what you played and can show a
                better line. No sign-up. Both engines run in this browser.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link className={buttonVariants({ size: "lg" })} href="/game">
                  Play now — it&apos;s free
                </Link>
                <Link
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                  href="/play/beginner"
                >
                  Start at beginner
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
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            What is Maia?
          </h2>
          <p className="text-muted-foreground">
            Maia is a neural-network chess engine trained on millions of human
            games. It is built to predict the move a player at a given rating
            would choose, not the objectively best move. That is why it feels
            like a person: familiar plans, realistic mistakes, and fewer
            computer-only traps.
          </p>
          <p className="text-muted-foreground">
            The best-known way to play Maia is on Lichess. chessgator runs a
            browser build (Maia3) locally, with strengths from Elo 1100 to 1900,
            and adds a coach on top. Read{" "}
            <Link
              href="/maia"
              className="text-primary underline-offset-4 hover:underline"
            >
              how Maia plays
            </Link>
            , pick a{" "}
            <Link
              href="/play/beginner"
              className="text-primary underline-offset-4 hover:underline"
            >
              beginner game
            </Link>
            , or open the{" "}
            <Link
              href="/game"
              className="text-primary underline-offset-4 hover:underline"
            >
              board
            </Link>
            .
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            A coach, not just an engine
          </h2>
          <p className="text-muted-foreground">
            Most “play vs computer” pages put a strong engine across the board.
            Stockfish will crush you; the lesson is mostly that you lost.
            chessgator keeps Stockfish off the board. It runs after your move:
            it classifies what you played, names the idea, and can show a
            stronger continuation. You keep playing Maia.
          </p>
          <p className="text-muted-foreground">
            You can step back through the game tree and try a different move
            without leaving the page. More on{" "}
            <Link
              href="/learn"
              className="text-primary underline-offset-4 hover:underline"
            >
              how the coach explains moves
            </Link>
            , plus{" "}
            <Link
              href="/openings"
              className="text-primary underline-offset-4 hover:underline"
            >
              openings
            </Link>{" "}
            and{" "}
            <Link
              href="/games"
              className="text-primary underline-offset-4 hover:underline"
            >
              example games
            </Link>
            .
          </p>
        </section>
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Compared with Chess.com and Lichess
            </h2>
            <p className="text-muted-foreground">
              Those sites are better if you want humans, puzzles, or a club.
              This one is for a human-like bot plus a local coach, with no
              sign-up.
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3 sm:gap-6">
            {COMPARISON.map((item) => (
              <div key={item.title} className="space-y-2">
                <h3 className="font-heading text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Ready for a game?
          </h2>
          <p className="text-muted-foreground">
            No sign-up. Open the board and make your first move — engines load
            in the browser once, about 30 MB the first time.
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
