import type { Metadata } from "next";
import Link from "next/link";
import { PLAY_LEVELS } from "@/app/play/levels";
import { ContentPage } from "@/components/content-page";
import { buttonVariants } from "@/components/ui/button";
import { gameHref } from "@/lib/game-href";
import { articleJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { cn } from "@/lib/utils";

const title = "Play Maia online";
const description =
  "Play Maia, a human-like chess neural network, in your browser on chessgator. No account, local coaching with Stockfish.";

export const metadata: Metadata = contentMetadata({
  title,
  description,
  path: "/maia",
});

export default function MaiaPage() {
  return (
    <ContentPage title={title} breadcrumbs={[{ name: "Maia", path: "/maia" }]}>
      <JsonLd
        data={articleJsonLd({ headline: title, description, path: "/maia" })}
      />
      <div className="space-y-4 text-muted-foreground">
        <p>
          Maia is a chess engine built by Reid McIlroy-Young and colleagues at
          the University of Toronto’s CSSLab. Instead of searching millions of
          positions, it uses a neural network trained on real human games at
          specific rating levels. At 1500 Elo it tries to play like a 1500-rated
          person—not like Stockfish at full strength.
        </p>
        <p>
          That difference matters for practice. Traditional engines find the
          best move in almost every position, which can feel unrealistic when
          you are preparing for club nights or online rated games against
          people. Maia makes human-shaped mistakes: practical plans, familiar
          structures, and errors you might actually see over the board.
        </p>
        <p>
          Lichess also hosts Maia bots at several ratings. chessgator runs Maia3
          locally in your browser through ONNX Runtime and WebAssembly—no
          sign-up and no move upload to a server. After each of your moves,
          Stockfish coaching analysis runs on your device and explains what you
          played and what was stronger.
        </p>
      </div>
      <p>
        <Link href={gameHref()} className={cn(buttonVariants({ size: "lg" }))}>
          Start a game
        </Link>
      </p>
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Pick a strength
        </h2>
        <p className="text-sm text-muted-foreground">
          Maia on chessgator ships at nine Elo steps from 1100 to 1900. Each
          link opens a short guide and a one-click game at that rating.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PLAY_LEVELS.map((level) => (
            <li key={level.slug}>
              <Link
                href={`/play/${level.slug}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {level.elo} · {level.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted-foreground">
        See the full list on the{" "}
        <Link
          href="/play"
          className="text-primary underline-offset-4 hover:underline"
        >
          play hub
        </Link>
        .
      </p>
    </ContentPage>
  );
}
