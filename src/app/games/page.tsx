import type { Metadata } from "next";
import Link from "next/link";
import { listGames } from "@/app/games/catalog";
import { ContentPage } from "@/components/content-page";
import { articleJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";

const title = "Famous chess games";
const description =
  "Annotated scores of classic games, with a static move list, a board you can step through, and a link to take the critical position against Maia.";

export const metadata: Metadata = contentMetadata({
  title,
  description,
  path: "/games",
});

export default function GamesHubPage() {
  const games = listGames();

  return (
    <ContentPage
      title={title}
      breadcrumbs={[{ name: "Games", path: "/games" }]}
    >
      <JsonLd
        data={articleJsonLd({
          headline: title,
          description,
          path: "/games",
          datePublished: "2026-08-16",
        })}
      />
      <p className="text-muted-foreground">
        Each page has the full score in HTML, a diagram of the critical
        position, and a short original note on why the game is still shown to
        students. Where Stockfish was run at build time, moves are classified
        the same way the in-browser coach does.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {games.map((game) => (
          <li key={game.slug} className="space-y-1 px-4 py-4">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              <Link
                href={`/games/${game.slug}`}
                className="underline-offset-4 hover:underline"
              >
                {game.title}
              </Link>
            </h2>
            <p className="text-sm text-muted-foreground">
              {game.year} · {game.white} vs {game.black} · {game.result}
            </p>
            <p className="text-sm text-muted-foreground">{game.hook}</p>
          </li>
        ))}
      </ul>
    </ContentPage>
  );
}
