import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "About · chessgator",
  description: "What chessgator is and how it coaches your chess.",
};

export default function AboutPage() {
  return (
    <SitePage title="About">
      <p className="text-muted-foreground">
        chessgator helps you learn by playing. You take on Maia, a human-like
        opponent, while a coach mascot explains the ideas behind better moves.
        Analysis stays on your device.
      </p>
    </SitePage>
  );
}
