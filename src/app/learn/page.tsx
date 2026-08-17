import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { contentMetadata } from "@/lib/page-metadata";
import { CATEGORY_LABEL, CATEGORY_ORDER, conceptsInCategory } from "./concepts";

export const metadata: Metadata = contentMetadata({
  title: "Learn chess tactics and concepts",
  description:
    "A glossary of tactics, checkmates, positional ideas, and endgames that chessgator teaches while you play.",
  path: "/learn",
  type: "website",
});

export default function LearnPage() {
  return (
    <ContentPage
      title="Learn"
      breadcrumbs={[{ name: "Learn", path: "/learn" }]}
    >
      <p className="text-muted-foreground">
        chessgator teaches these ideas while you play. After a move, the coach
        names the tactic or positional theme that mattered. This glossary is the
        same vocabulary, each with a diagram you can load on the board.
      </p>
      {CATEGORY_ORDER.map((category) => (
        <section key={category} className="space-y-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {CATEGORY_LABEL[category]}
          </h2>
          <ul className="space-y-3">
            {conceptsInCategory(category).map((concept) => (
              <li key={concept.slug}>
                <Link
                  href={`/learn/${concept.slug}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {concept.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {concept.definition}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ContentPage>
  );
}
