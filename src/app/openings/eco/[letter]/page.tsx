import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { contentMetadata } from "@/lib/page-metadata";
import {
  ECO_LETTERS,
  type EcoLetter,
  getOpeningsByEcoLetter,
} from "../../data";

type PageProps = {
  params: Promise<{ letter: string }>;
};

const ECO_BLURB: Record<EcoLetter, string> = {
  A: "Flank and irregular openings, including systems with an early Nf3, b3, or g3.",
  B: "Semi-open games after 1. e4 where Black avoids …e5—Sicilian, Caro-Kann, Alekhine, and related defenses.",
  C: "Open games (1. e4 e5), French, Scandinavian, and several gambits.",
  D: "Queen-pawn games: Queen's Gambit, Slav, Grünfeld, and closed structures.",
  E: "Indian defenses and related systems: King's Indian, Nimzo-Indian, Benoni, and more.",
};

export function generateStaticParams() {
  return ECO_LETTERS.map((letter) => ({ letter: letter.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { letter } = await params;
  const upper = letter.toUpperCase();
  if (!ECO_LETTERS.includes(upper as EcoLetter)) {
    return { title: "ECO openings" };
  }
  return contentMetadata({
    title: `ECO ${upper} openings`,
    description: `ECO volume ${upper}: ${ECO_BLURB[upper as EcoLetter]}`,
    path: `/openings/eco/${letter.toLowerCase()}`,
  });
}

export default async function EcoLetterPage({ params }: PageProps) {
  const { letter } = await params;
  const upper = letter.toUpperCase();
  if (!ECO_LETTERS.includes(upper as EcoLetter)) notFound();

  const openings = getOpeningsByEcoLetter(upper);

  return (
    <ContentPage
      title={`ECO ${upper} openings`}
      breadcrumbs={[
        { name: "Openings", path: "/openings" },
        { name: `ECO ${upper}`, path: `/openings/eco/${letter.toLowerCase()}` },
      ]}
    >
      <p className="text-muted-foreground">{ECO_BLURB[upper as EcoLetter]}</p>
      <p className="text-sm text-muted-foreground">
        {openings.length} entries in this volume.
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
