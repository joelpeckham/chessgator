import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site-page";
import { contentMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = contentMetadata({
  title: "How This Free Chess Coach Works",
  description:
    "A free browser chess coach: play a human-like Maia bot, get Stockfish explanations after every move, and keep games on your device. No account.",
  path: "/about",
  type: "website",
});

export default function AboutPage() {
  return (
    <SitePage title="How this free chess coach works">
      <p className="text-muted-foreground">
        chessgator is a free chess coach in the browser. You play Maia, a
        human-like bot from Elo 1100 to 1900, while a coach explains the ideas
        behind better moves. There is no account. Analysis stays on your device.
      </p>
      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          How a session works
        </h2>
        <p className="text-muted-foreground">
          Pick a side and a Maia strength, then play. After each of your moves,
          Stockfish runs locally and the coach classifies what you played, names
          the idea, and can suggest a stronger line. You can step back through
          the game tree to try a different move without leaving the browser.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Credits
        </h2>
        <p className="text-muted-foreground">
          Opponent play uses Maia, a neural network trained on human games.
          Coaching analysis uses Stockfish. Both run in the browser through ONNX
          Runtime and WebAssembly. chessgator is built by Joel Peckham. Source
          and third-party licenses are on the{" "}
          <Link
            href="/notices"
            className="text-primary underline-offset-4 hover:underline"
          >
            notices
          </Link>{" "}
          page.
        </p>
      </section>
      <p className="text-muted-foreground">
        More on{" "}
        <Link
          href="/maia"
          className="text-primary underline-offset-4 hover:underline"
        >
          Maia
        </Link>
        ,{" "}
        <Link
          href="/learn"
          className="text-primary underline-offset-4 hover:underline"
        >
          how the coach explains moves
        </Link>
        , and the{" "}
        <Link
          href="/faq"
          className="text-primary underline-offset-4 hover:underline"
        >
          FAQ
        </Link>
        .
      </p>
    </SitePage>
  );
}
