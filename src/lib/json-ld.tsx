import { personProfile, personRef, relatedApps } from "@/lib/product-graph";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const CHESSGATOR_APP_ID = "https://chessgator.com/#app";
const CHESSGATOR_WEBSITE_ID = "https://chessgator.com/#website";
const CHESSGATOR_SAME_AS = [
  "https://jpeckham.com/projects/chessgator/",
  "https://github.com/joelpeckham/chessgator",
] as const;

type JsonLdProps = {
  data: unknown;
};

export type BreadcrumbItem = {
  name: string;
  path: string;
};

/** Serializes structured data and escapes `<` so the payload cannot break out of the script tag. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is serialized from our own objects
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll("<", "\\u003c"),
      }}
    />
  );
}

function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleJsonLd(args: {
  headline: string;
  description: string;
  path: string;
  datePublished?: string;
}) {
  const url = absoluteUrl(args.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: args.headline,
    description: args.description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    author: personRef(),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/opengraph-image`,
      },
    },
    ...(args.datePublished ? { datePublished: args.datePublished } : {}),
  };
}

export function collectionPageJsonLd(args: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.path),
  };
}

export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    ...personProfile(),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": CHESSGATOR_WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    author: personRef(),
    publisher: personRef(),
  };
}

export function webApplicationJsonLd(args: {
  description: string;
  path?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": CHESSGATOR_APP_ID,
    name: SITE_NAME,
    url: args.path ? absoluteUrl(args.path) : SITE_URL,
    description: args.description,
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    browserRequirements:
      "Requires a modern browser with WebAssembly and Web Workers.",
    author: personRef(),
    creator: personRef(),
    sameAs: [...CHESSGATOR_SAME_AS],
    isRelatedTo: relatedApps("chessgator"),
  };
}
