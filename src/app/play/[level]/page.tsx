import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { buttonVariants } from "@/components/ui/button";
import { gameHref } from "@/lib/game-href";
import { articleJsonLd, JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { cn } from "@/lib/utils";
import {
  findPlayLevel,
  levelStaticParams,
  PLAY_LEVELS,
  type PlayLevel,
} from "../levels";

type PageProps = {
  params: Promise<{ level: string }>;
};

export function generateStaticParams() {
  return levelStaticParams();
}

function pagePath(level: PlayLevel): string {
  return `/play/${level.slug}`;
}

function neighbors(elo: number): {
  previous: PlayLevel | undefined;
  next: PlayLevel | undefined;
} {
  const index = PLAY_LEVELS.findIndex((entry) => entry.elo === elo);
  return {
    previous: index > 0 ? PLAY_LEVELS[index - 1] : undefined,
    next:
      index >= 0 && index < PLAY_LEVELS.length - 1
        ? PLAY_LEVELS[index + 1]
        : undefined,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { level: levelParam } = await params;
  const level = findPlayLevel(levelParam);
  if (!level) return {};

  const headline = `Play chess against a ${level.elo} Elo bot`;
  return contentMetadata({
    title: headline,
    description: level.description,
    path: pagePath(level),
  });
}

export default async function PlayLevelPage({ params }: PageProps) {
  const { level: levelParam } = await params;
  const level = findPlayLevel(levelParam);
  if (!level) notFound();

  const headline = `Play chess against a ${level.elo} Elo bot`;
  const { previous, next } = neighbors(level.elo);

  return (
    <ContentPage
      title={headline}
      breadcrumbs={[
        { name: "Play", path: "/play" },
        { name: level.label, path: pagePath(level) },
      ]}
    >
      <JsonLd
        data={articleJsonLd({
          headline,
          description: level.description,
          path: pagePath(level),
        })}
      />
      <div className="space-y-4 text-muted-foreground">
        {level.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>
      <p>
        <Link
          href={gameHref({ elo: level.elo })}
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Play {level.label} ({level.elo} Elo)
        </Link>
      </p>
      <nav
        aria-label="Other Maia strengths"
        className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
      >
        {previous ? (
          <Link
            href={`/play/${previous.slug}`}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            ← {previous.elo} · {previous.label}
          </Link>
        ) : null}
        {next ? (
          <Link
            href={`/play/${next.slug}`}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {next.elo} · {next.label} →
          </Link>
        ) : null}
        <Link
          href="/play"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          All strengths
        </Link>
        <Link
          href="/maia"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          About Maia
        </Link>
      </nav>
    </ContentPage>
  );
}
