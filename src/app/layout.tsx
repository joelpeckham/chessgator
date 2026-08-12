import type { Metadata, Viewport } from "next";
import { Figtree, Merriweather } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const merriweatherHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const description =
  "Local-only chess coach. Play as White against Maia with Stockfish coaching analysis.";

export const metadata: Metadata = {
  metadataBase: new URL("https://chessgator.com"),
  title: "chessgator",
  description,
  applicationName: "chessgator",
  openGraph: {
    title: "chessgator",
    description,
    url: "/",
    siteName: "chessgator",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "chessgator",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f8e9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        figtree.variable,
        merriweatherHeading.variable,
      )}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
