import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How chessgator handles your games and data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <SitePage title="Privacy policy">
      <p className="text-muted-foreground">
        This policy describes how chessgator handles information. The site is
        operated by Joel Peckham. Contact:{" "}
        <a
          href="mailto:mail@jpeckham.com"
          className="text-primary underline-offset-4 hover:underline"
        >
          mail@jpeckham.com
        </a>
        . Effective 15 August 2026.
      </p>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          What stays on your device
        </h2>
        <p className="text-muted-foreground">
          chessgator does not have accounts. The active game is saved in this
          browser under the local storage key{" "}
          <code className="text-foreground">chessgator:game:v2</code>. That
          record can include the move tree, whose turn it is, your chosen side
          and Maia strength, and coaching notes for positions you have played.
          It never leaves the device through the app.
        </p>
        <p className="text-muted-foreground">
          Start a new game from the app settings to reset the board. To delete
          the stored record, clear this site&apos;s data in your browser.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Hosting
        </h2>
        <p className="text-muted-foreground">
          The site is hosted on Vercel. When you load a page, Vercel may record
          standard access logs such as IP address, user agent, and the URL
          requested. Those logs are processed by Vercel as the hosting provider,
          not stored by chessgator as a game history.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Analytics
        </h2>
        <p className="text-muted-foreground">
          chessgator uses Vercel Web Analytics to count page views. The script
          is cookieless. It does not identify you across sites, and it does not
          record your moves or game state. We use it only to see which pages are
          visited.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Cookies and what we do not do
        </h2>
        <p className="text-muted-foreground">
          chessgator does not set cookies. We do not sell personal data, run
          advertising, or send your games to a third-party chess service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Your rights
        </h2>
        <p className="text-muted-foreground">
          If you are in the EU, UK, or another place with similar privacy law,
          you can ask what data we hold, ask for a copy, ask us to correct or
          delete it, or object to processing. Game data lives only in your
          browser, so the practical way to delete it is to clear this
          site&apos;s storage. For questions about hosting logs or analytics,
          email{" "}
          <a
            href="mailto:mail@jpeckham.com"
            className="text-primary underline-offset-4 hover:underline"
          >
            mail@jpeckham.com
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Changes
        </h2>
        <p className="text-muted-foreground">
          If this policy changes, the updated text will be posted on this page
          with a new effective date.
        </p>
      </section>
    </SitePage>
  );
}
