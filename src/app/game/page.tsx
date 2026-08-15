import type { Metadata } from "next";
import { GameShellClient } from "@/components/game/game-shell-client";
import { JsonLd } from "@/lib/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Play",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/game" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: `${SITE_URL}/game`,
  description: SITE_DESCRIPTION,
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  browserRequirements:
    "Requires a modern browser with WebAssembly and Web Workers.",
};

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
