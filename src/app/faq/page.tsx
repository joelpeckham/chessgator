import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";
import { JsonLd } from "@/lib/json-ld";
import { contentMetadata } from "@/lib/page-metadata";
import { FAQ_ITEMS } from "./questions";

export const metadata: Metadata = contentMetadata({
  title: "Free Chess Coach FAQ",
  description:
    "Can I play Maia outside Lichess? Is there a free chess coach that explains moves? How do I play chess vs a computer with no sign-up?",
  path: "/faq",
  type: "website",
});

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <SitePage title="FAQ">
      <JsonLd data={faqJsonLd} />
      {FAQ_ITEMS.map((item) => (
        <section key={item.question} className="space-y-2">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-pretty">
            {item.question}
          </h2>
          <p className="text-muted-foreground">{item.answer}</p>
        </section>
      ))}
    </SitePage>
  );
}
