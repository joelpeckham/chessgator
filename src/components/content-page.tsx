import Link from "next/link";
import type { ReactNode } from "react";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { buttonVariants } from "@/components/ui/button";
import { type BreadcrumbItem, breadcrumbJsonLd, JsonLd } from "@/lib/json-ld";
import { cn } from "@/lib/utils";

export type ContentPageProps = {
  title: string;
  breadcrumbs?: readonly BreadcrumbItem[];
  children: ReactNode;
  className?: string;
};

export function ContentPage({
  title,
  breadcrumbs,
  children,
  className,
}: ContentPageProps) {
  const crumbs: BreadcrumbItem[] = [
    { name: "Home", path: "/" },
    ...(breadcrumbs ?? []),
  ];

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <header className="shrink-0 border-b border-border">
        <div className="flex h-12 items-center justify-between gap-3 px-3 sm:px-4">
          <ChessgatorWordmark href="/" />
          <div className="flex items-center gap-3">
            <SiteNav className="hidden sm:flex" />
            <Link className={buttonVariants({ size: "sm" })} href="/game">
              Play
            </Link>
          </div>
        </div>
        <SiteNav className="flex flex-wrap px-3 py-2 sm:hidden" />
      </header>
      <main
        className={cn(
          "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10",
          className,
        )}
      >
        {crumbs.length > 1 ? (
          <nav
            aria-label="Breadcrumb"
            className="text-sm text-muted-foreground"
          >
            <ol className="flex flex-wrap items-center gap-1">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={crumb.path} className="flex items-center gap-1">
                    {index > 0 ? <span aria-hidden>/</span> : null}
                    {last ? (
                      <span className="text-foreground">{crumb.name}</span>
                    ) : (
                      <Link
                        href={crumb.path}
                        className="underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-pretty">
          {title}
        </h1>
        {children}
      </main>
      <footer>
        <SiteFooter />
      </footer>
    </div>
  );
}
