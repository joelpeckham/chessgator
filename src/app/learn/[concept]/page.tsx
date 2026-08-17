import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StaticBoard } from "@/components/board/static-board";
import { ContentPage } from "@/components/content-page";
import { buttonVariants } from "@/components/ui/button";
import { gameHref } from "@/lib/game-href";
import { articleJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { CONCEPTS, getConcept } from "../concepts";

type ConceptPageProps = {
  params: Promise<{ concept: string }>;
};

export function generateStaticParams() {
  return CONCEPTS.map((concept) => ({ concept: concept.slug }));
}

export async function generateMetadata({
  params,
}: ConceptPageProps): Promise<Metadata> {
  const { concept: slug } = await params;
  const concept = getConcept(slug);
  if (!concept) {
    return {};
  }
  return contentMetadata({
    title: concept.title,
    description: concept.description,
    path: `/learn/${concept.slug}`,
  });
}

export default async function ConceptPage({ params }: ConceptPageProps) {
  const { concept: slug } = await params;
  const concept = getConcept(slug);
  if (!concept) {
    notFound();
  }

  const path = `/learn/${concept.slug}`;

  return (
    <ContentPage
      title={concept.title}
      breadcrumbs={[
        { name: "Learn", path: "/learn" },
        { name: concept.title, path },
      ]}
    >
      <JsonLd
        data={articleJsonLd({
          headline: concept.title,
          description: concept.description,
          path,
        })}
      />
      <p className="text-muted-foreground">{concept.definition}</p>
      <StaticBoard
        fen={concept.fen}
        title={concept.boardTitle}
        highlights={concept.highlights}
        orientation={concept.color}
      />
      {concept.paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground">
          {paragraph}
        </p>
      ))}
      <p>
        <Link
          className={buttonVariants()}
          href={gameHref({ fen: concept.fen, color: concept.color })}
        >
          Play this position
        </Link>
      </p>
    </ContentPage>
  );
}
