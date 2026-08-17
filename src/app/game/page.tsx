import type { Metadata } from "next";
import { GameShellClient } from "@/components/game/game-shell-client";
import { JsonLd, webApplicationJsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";

const GAME_DESCRIPTION =
  "Play chess against a computer with no sign-up. Maia is a human-like bot (Elo 1100–1900); a Stockfish coach explains your moves in the browser.";

export const metadata: Metadata = contentMetadata({
  title: "Play Chess vs a Computer — No Sign Up",
  description: GAME_DESCRIPTION,
  path: "/game",
  type: "website",
});

const jsonLd = webApplicationJsonLd({
  description: GAME_DESCRIPTION,
  path: "/game",
});

/**
 * Build-time static shell. All browser APIs, workers, and interactivity live
 * under the client `GameShell` boundary.
 */
export default function GamePage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <GameShellClient />
    </>
  );
}
