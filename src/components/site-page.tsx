import Link from "next/link";
import type { ReactNode } from "react";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { SiteFooter } from "@/components/site-footer";

export function SitePage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center border-b border-border px-3 sm:px-4">
        <ChessgatorWordmark href="/" />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-10">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-pretty">
          {title}
        </h1>
        {children}
        <p>
          <Link
            href="/game"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Back to the board
          </Link>
        </p>
      </main>
      <footer>
        <SiteFooter />
      </footer>
    </div>
  );
}
