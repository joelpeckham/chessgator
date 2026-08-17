import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { contentMetadata } from "@/lib/page-metadata";
import { ECO_LETTERS, OPENINGS_SOURCE, popularOpenings } from "./data";
import { FEATURED_FIRST_MOVES, featuredFirstMoveLabel } from "./first-moves";

export const metadata: Metadata = contentMetadata({
  title: "Chess openings encyclopedia",
  description:
    "Browse 3,800+ ECO-classified chess openings with diagrams and links to practice each line against Maia.",
  path: "/openings",
});

export default function OpeningsHubPage() {
  const popular = popularOpenings();

  return (
    <ContentPage
      title="Chess openings encyclopedia"
      breadcrumbs={[{ name: "Openings", path: "/openings" }]}
    >
      <p className="text-muted-foreground">
        This index lists chess openings from the{" "}
        <a
          href="https://github.com/lichess-org/chess-openings"
          className="text-primary underline-offset-4 hover:underline"
          rel="noopener noreferrer"
        >
          Lichess CC0 chess-openings
        </a>{" "}
        dataset ({OPENINGS_SOURCE}). Each entry includes ECO code, SAN move
        order, a diagram, and a link to practice the line against Maia.
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Browse by ECO volume
        </h2>
        <ul className="flex flex-wrap gap-2">
          {ECO_LETTERS.map((letter) => (
            <li key={letter}>
              <Link
                href={`/openings/eco/${letter.toLowerCase()}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                ECO {letter}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Browse by first move
        </h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {FEATURED_FIRST_MOVES.map((move) => (
            <li key={move}>
              <Link
                href={`/openings/first-move/${move}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {featuredFirstMoveLabel(move)}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/openings/first-move/others"
              className="text-primary underline-offset-4 hover:underline"
            >
              Other first moves
            </Link>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Popular openings
        </h2>
        <ul className="columns-1 gap-x-8 sm:columns-2">
          {popular.map((opening) => (
            <li key={opening.slug} className="break-inside-avoid pb-1">
              <Link
                href={`/openings/${opening.slug}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {opening.name}
              </Link>
              <span className="text-muted-foreground"> ({opening.eco})</span>
            </li>
          ))}
        </ul>
      </section>
    </ContentPage>
  );
}
