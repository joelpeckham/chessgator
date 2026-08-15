import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "FAQ · chessgator",
  description: "Common questions about chessgator, the local-only chess coach.",
};

export default function FaqPage() {
  return (
    <SitePage title="FAQ">
      <p className="text-muted-foreground">
        chessgator is a local-only chess coach. Play against Maia and get
        Stockfish-backed feedback after each move. More answers will land here
        as the app grows.
      </p>
    </SitePage>
  );
}
