import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

/** Canonical + Open Graph + Twitter metadata for a static content page. */
export function contentMetadata(args: {
  title: string;
  description: string;
  path: string;
  type?: "article" | "website";
}): Metadata {
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const type = args.type ?? "article";
  return {
    title: args.title,
    description: args.description,
    alternates: { canonical: path },
    openGraph: {
      title: args.title,
      description: args.description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: args.title,
      description: args.description,
    },
  };
}
