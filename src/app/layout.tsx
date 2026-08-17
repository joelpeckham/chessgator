import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Figtree, Merriweather } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { cn } from "@/lib/utils";

const merriweatherHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SITE_KEYWORDS],
  category: "games",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f8e9",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        figtree.variable,
        merriweatherHeading.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
