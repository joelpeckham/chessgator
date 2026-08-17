import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StaticBoard } from "@/components/board/static-board";
import { ContentPage } from "@/components/content-page";
import { buttonVariants } from "@/components/ui/button";
import { fenAfterMoves } from "@/lib/fen-from-moves";
import { gameHref } from "@/lib/game-href";
import { articleJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { cn } from "@/lib/utils";
import { allOpeningSlugs, getOpeningBySlug } from "../data";
import { openingDescription, openingIdeas } from "../ideas";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return allOpeningSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const opening = getOpeningBySlug(slug);
  if (!opening) return { title: "Opening" };
  return contentMetadata({
    title: `${opening.name} (${opening.eco})`,
    description: openingDescription(opening),
    path: `/openings/${slug}`,
  });
}

function formatSanLine(moves: readonly string[]): string {
  let text = "";
  for (let i = 0; i < moves.length; i += 1) {
    const moveNumber = Math.floor(i / 2) + 1;
    if (i % 2 === 0) text += `${moveNumber}. `;
    text += moves[i] ?? "";
    if (i < moves.length - 1) text += " ";
  }
  return text.trim();
}

export default async function OpeningPage({ params }: PageProps) {
  const { slug } = await params;
  const opening = getOpeningBySlug(slug);
  if (!opening) notFound();

  const path = `/openings/${slug}`;
  const fen = opening.fen ?? fenAfterMoves(opening.moves) ?? undefined;
  const description = openingDescription(opening);

  return (
    <ContentPage
      title={opening.name}
      breadcrumbs={[
        { name: "Openings", path: "/openings" },
        {
          name: opening.eco,
          path: `/openings/eco/${opening.eco.charAt(0).toLowerCase()}`,
        },
        { name: opening.name, path },
      ]}
    >
      <JsonLd
        data={articleJsonLd({
          headline: opening.name,
          description,
          path,
        })}
      />

      <p className="text-muted-foreground">
        ECO{" "}
        <Link
          href={`/openings/eco/${opening.eco.charAt(0).toLowerCase()}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {opening.eco}
        </Link>
      </p>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Move order
        </h2>
        <p className="font-mono text-sm text-muted-foreground">
          {formatSanLine(opening.moves)}
        </p>
      </section>

      {fen ? (
        <StaticBoard
          fen={fen}
          title={`${opening.name} (${opening.eco})`}
          className="max-w-xs"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Could not render the diagram for this line.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Ideas
        </h2>
        <p className="text-muted-foreground">{openingIdeas(opening)}</p>
      </section>

      <div>
        <Link
          href={gameHref({ moves: [...opening.moves] })}
          className={cn(buttonVariants())}
        >
          Play this opening against Maia
        </Link>
      </div>
    </ContentPage>
  );
}
