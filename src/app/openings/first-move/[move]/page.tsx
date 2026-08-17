import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { contentMetadata } from "@/lib/page-metadata";
import { OPENINGS } from "../../data";
import {
  FEATURED_FIRST_MOVES,
  type FeaturedFirstMove,
  featuredFirstMoveLabel,
  isFeaturedFirstMove,
  openingMatchesFeaturedFirstMove,
} from "../../first-moves";

type PageProps = {
  params: Promise<{ move: string }>;
};

export function generateStaticParams() {
  return [
    ...FEATURED_FIRST_MOVES.map((move) => ({ move })),
    { move: "others" },
  ];
}

function openingsForHub(move: string) {
  if (move === "others") {
    return OPENINGS.filter(
      (opening) =>
        !FEATURED_FIRST_MOVES.some((featured) =>
          openingMatchesFeaturedFirstMove(opening, featured),
        ),
    );
  }
  if (!isFeaturedFirstMove(move)) return null;
  return OPENINGS.filter((opening) =>
    openingMatchesFeaturedFirstMove(opening, move),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { move } = await params;
  if (move === "others") {
    return contentMetadata({
      title: "Openings by other first moves",
      description:
        "Chess openings grouped by less common first moves—flank lines, gambits, and rare systems.",
      path: "/openings/first-move/others",
    });
  }
  if (!isFeaturedFirstMove(move)) {
    return { title: "Openings by first move" };
  }
  const label = featuredFirstMoveLabel(move);
  return contentMetadata({
    title: `Openings after ${label}`,
    description: `ECO-classified chess openings that begin with ${label}.`,
    path: `/openings/first-move/${move}`,
  });
}

export default async function FirstMovePage({ params }: PageProps) {
  const { move } = await params;
  const openings = openingsForHub(move);
  if (!openings) notFound();

  if (move === "others") {
    const byMove = new Map<string, typeof openings>();
    for (const opening of openings) {
      const key = opening.firstMove;
      const group = byMove.get(key) ?? [];
      group.push(opening);
      byMove.set(key, group);
    }
    const sortedKeys = [...byMove.keys()].toSorted((a, b) =>
      a.localeCompare(b),
    );

    return (
      <ContentPage
        title="Openings by other first moves"
        breadcrumbs={[
          { name: "Openings", path: "/openings" },
          { name: "Other first moves", path: "/openings/first-move/others" },
        ]}
      >
        <p className="text-muted-foreground">
          Lines that do not start with 1. e4, 1. d4, 1. c4, 1. Nf3, 1. g3, 1.
          b3, 1. f4, or 1. Nc3.
        </p>
        {sortedKeys.map((firstMove) => {
          const group = byMove.get(firstMove) ?? [];
          return (
            <section key={firstMove} className="space-y-2">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                1. {firstMove}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({group.length})
                </span>
              </h2>
              <ul className="columns-1 gap-x-8 sm:columns-2">
                {group.map((opening) => (
                  <li key={opening.slug} className="break-inside-avoid pb-1">
                    <Link
                      href={`/openings/${opening.slug}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {opening.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      ({opening.eco})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </ContentPage>
    );
  }

  const featured = move as FeaturedFirstMove;
  const label = featuredFirstMoveLabel(featured);

  return (
    <ContentPage
      title={`Openings after ${label}`}
      breadcrumbs={[
        { name: "Openings", path: "/openings" },
        { name: label, path: `/openings/first-move/${move}` },
      ]}
    >
      <p className="text-muted-foreground">
        {openings.length} ECO entries beginning with {label}.
      </p>
      <ul className="columns-1 gap-x-8 sm:columns-2 lg:columns-3">
        {openings.map((opening) => (
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
    </ContentPage>
  );
}
