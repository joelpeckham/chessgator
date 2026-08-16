import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "About",
  description: "What chessgator is and how it coaches your chess.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

export default function AboutPage() {
  return (
    <SitePage title="About">
      <p className="text-muted-foreground">
        chessgator helps you learn by playing. You take on Maia, a human-like
        opponent, while a coach mascot explains the ideas behind better moves.
        Analysis stays on your device.
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
    </SitePage>
  );
}
