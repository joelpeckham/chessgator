import type { MetadataRoute } from "next";
import { contentPaths as gameContentPaths } from "@/app/games/slugs";
import { contentPaths as learnContentPaths } from "@/app/learn/slugs";
import { contentPaths as maiaContentPaths } from "@/app/maia/slugs";
import { contentPaths as openingContentPaths } from "@/app/openings/slugs";
import { contentPaths as playContentPaths } from "@/app/play/slugs";
import { SITE_URL } from "@/lib/site";
import { sitemapEntries } from "@/lib/sitemap-entries";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-16");
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/game`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...sitemapEntries(playContentPaths(), {
      lastModified,
      priority: 0.75,
    }),
    ...sitemapEntries(maiaContentPaths(), {
      lastModified,
      priority: 0.8,
    }),
    ...sitemapEntries(learnContentPaths(), {
      lastModified,
      priority: 0.65,
    }),
    ...sitemapEntries(openingContentPaths(), {
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    }),
    ...sitemapEntries(gameContentPaths(), {
      lastModified,
      priority: 0.65,
    }),
    {
      url: `${SITE_URL}/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/notices`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
