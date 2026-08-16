"use client";

import { Figtree, Merriweather } from "next/font/google";
import { SiteCrash } from "@/components/site-crash";
import { cn } from "@/lib/utils";
import "./globals.css";

const merriweatherHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        figtree.variable,
        merriweatherHeading.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <SiteCrash title="Something went off the board." onRetry={reset} />
      </body>
    </html>
  );
}
