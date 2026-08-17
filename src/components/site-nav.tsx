import Link from "next/link";
import { cn } from "@/lib/utils";

export const SITE_CONTENT_LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/openings", label: "Openings" },
  { href: "/games", label: "Games" },
  { href: "/maia", label: "Maia" },
] as const;

export function SiteNav({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Content"
      className={cn("flex items-center gap-3", className)}
    >
      {SITE_CONTENT_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
