import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findGame,
  gameStaticParams,
  listGames,
  takeOverSeat,
} from "@/app/games/catalog";
import type { FamousGame, GamePly } from "@/app/games/data/types";
import { GameStepper } from "@/app/games/game-stepper";
import { StaticBoard } from "@/components/board/static-board";
import { ContentPage } from "@/components/content-page";
import { buttonVariants } from "@/components/ui/button";
import { gameHref } from "@/lib/game-href";
import { articleJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return gameStaticParams();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = findGame(slug);
  if (!game) return {};
  return contentMetadata({
    title: game.title,
    description: game.hook,
    path: `/games/${game.slug}`,
  });
}

function moveNumberLabel(index: number): string {
  const full = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? `${full}.` : `${full}...`;
}

function plyText(ply: GamePly): string {
  return ply.classification ? `${ply.san} (${ply.classification})` : ply.san;
}

function scoreRows(plies: readonly GamePly[]): {
  key: string;
  number: number;
  white: string;
  black: string | null;
  notes: string[];
}[] {
  const rows = [];
  for (let i = 0; i < plies.length; i += 2) {
    const white = plies[i];
    const black = plies[i + 1];
    if (!white) continue;
    const notes = [
      white.comment ? `${white.san}: ${white.comment}` : null,
      black?.comment ? `${black.san}: ${black.comment}` : null,
    ].filter((note): note is string => Boolean(note));
    rows.push({
      key: `${i}-${white.san}`,
      number: i / 2 + 1,
      white: plyText(white),
      black: black ? plyText(black) : null,
      notes,
    });
  }
  return rows;
}

export default async function FamousGamePage({ params }: PageProps) {
  const { slug } = await params;
  const game = findGame(slug);
  if (!game) notFound();

  const seat = takeOverSeat(game);
  const neighbors = adjacentGames(game.slug);
  const path = `/games/${game.slug}`;
  const colorLabel = seat.color === "black" ? "Black" : "White";

  return (
    <ContentPage
      title={game.title}
      breadcrumbs={[
        { name: "Games", path: "/games" },
        { name: game.title, path },
      ]}
    >
      <JsonLd
        data={articleJsonLd({
          headline: game.title,
          description: game.hook,
          path,
          datePublished: "2026-08-16",
        })}
      />
      <p className="text-muted-foreground">{game.intro}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">White</dt>
        <dd>{game.white}</dd>
        <dt className="text-muted-foreground">Black</dt>
        <dd>{game.black}</dd>
        <dt className="text-muted-foreground">Event</dt>
        <dd>{game.event}</dd>
        <dt className="text-muted-foreground">Year</dt>
        <dd>{game.year}</dd>
        <dt className="text-muted-foreground">Result</dt>
        <dd>{game.result}</dd>
      </dl>
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Critical position
        </h2>
        <StaticBoard
          fen={seat.fen}
          title={`${game.title}, after ply ${seat.ply}`}
          orientation={seat.color}
        />
        <p className="text-sm text-muted-foreground">
          After {moveNumberLabel(seat.ply - 1)} {game.plies[seat.ply - 1]?.san}.{" "}
          {colorLabel} to move.
        </p>
        <p>
          <Link
            href={gameHref({
              moves: game.plies.map((ply) => ply.san),
              ply: seat.ply,
              elo: game.takeOverElo,
            })}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Take over as {colorLabel} vs Maia
          </Link>
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Step through
        </h2>
        <GameStepper
          plies={game.plies}
          initialPly={seat.ply}
          orientation={seat.color}
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Annotated score
        </h2>
        <ol className="space-y-2">
          {scoreRows(game.plies).map((row) => (
            <li key={row.key} className="text-sm">
              <p>
                <span className="font-medium text-foreground">
                  {row.number}.
                </span>{" "}
                {row.white}
                {row.black ? <> {row.black}</> : null}
              </p>
              {row.notes.map((note) => (
                <p key={note} className="mt-1 text-muted-foreground">
                  {note}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </section>
      <nav
        aria-label="Other famous games"
        className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
      >
        {neighbors.previous ? (
          <Link
            href={`/games/${neighbors.previous.slug}`}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            ← {neighbors.previous.title}
          </Link>
        ) : null}
        {neighbors.next ? (
          <Link
            href={`/games/${neighbors.next.slug}`}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {neighbors.next.title} →
          </Link>
        ) : null}
        <Link
          href="/games"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          All games
        </Link>
      </nav>
    </ContentPage>
  );
}

function adjacentGames(slug: string): {
  previous: FamousGame | undefined;
  next: FamousGame | undefined;
} {
  const games = listGames();
  const index = games.findIndex((game) => game.slug === slug);
  return {
    previous: index > 0 ? games[index - 1] : undefined,
    next: index >= 0 && index < games.length - 1 ? games[index + 1] : undefined,
  };
}
