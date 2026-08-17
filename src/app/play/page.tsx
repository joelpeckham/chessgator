import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { buttonVariants } from "@/components/ui/button";
import { gameHref } from "@/lib/game-href";
import { collectionPageJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { cn } from "@/lib/utils";
import { PLAY_LEVELS } from "./levels";

const title = "Play chess against a computer";
const description =
  "Pick a Maia strength from 1100 to 1900 Elo and start a human-like game in your browser. No account required.";

export const metadata: Metadata = contentMetadata({
  title,
  description,
  path: "/play",
  type: "website",
});

export default function PlayHubPage() {
  return (
    <ContentPage title={title} breadcrumbs={[{ name: "Play", path: "/play" }]}>
      <JsonLd
        data={collectionPageJsonLd({
          name: title,
          description,
          path: "/play",
        })}
      />
      <p className="text-muted-foreground">
        chessgator runs Maia, a neural network trained on human games, at nine
        strength levels from 1100 to 1900 Elo. Choose the rating that matches
        where you play today—or the step above—and start a fresh game with local
        coaching analysis.
      </p>
      <p className="text-muted-foreground">
        Each level below links to a short guide and a one-click start. You can
        also read{" "}
        <Link
          href="/maia"
          className="text-primary underline-offset-4 hover:underline"
        >
          what Maia is
        </Link>{" "}
        and how it differs from a traditional engine.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {PLAY_LEVELS.map((level) => (
          <li
            key={level.elo}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                <Link
                  href={`/play/${level.slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {level.elo} · {level.label}
                </Link>
              </h2>
              <p className="text-sm text-muted-foreground">{level.hubBlurb}</p>
            </div>
            <Link
              href={gameHref({ elo: level.elo })}
              className={cn(buttonVariants(), "shrink-0")}
            >
              Play {level.label}
            </Link>
          </li>
        ))}
      </ul>
    </ContentPage>
  );
}
