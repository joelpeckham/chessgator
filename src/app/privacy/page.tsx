import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Privacy · chessgator",
  description: "How chessgator handles your games and data.",
};

export default function PrivacyPage() {
  return (
    <SitePage title="Privacy policy">
      <p className="text-muted-foreground">
        chessgator runs locally in your browser. Games and engine analysis stay
        on this device. A fuller privacy policy will replace this placeholder.
      </p>
    </SitePage>
  );
}
