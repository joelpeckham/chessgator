import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export type SitemapPathOptions = {
  lastModified?: Date;
  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority?: number;
};

/** Map absolute site paths (`/learn/pin`) to sitemap entries. */
export function sitemapEntries(
  paths: readonly string[],
  options: SitemapPathOptions = {},
): MetadataRoute.Sitemap {
  const lastModified = options.lastModified ?? new Date("2026-08-16");
  return paths.map((path) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return {
      url: `${SITE_URL}${normalized}`,
      lastModified,
      changeFrequency: options.changeFrequency ?? "monthly",
      priority: options.priority ?? 0.6,
    };
  });
}
