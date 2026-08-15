import Link from "next/link";
import { cn } from "@/lib/utils";

/** Single-row footer height; reserved in the game-shell viewport math. */
export const SITE_FOOTER_H = 32;

const LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Site"
      data-testid="site-footer"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border bg-background px-3 text-xs text-muted-foreground sm:px-4",
        className,
      )}
      style={{ height: SITE_FOOTER_H }}
    >
      <p className="truncate">© {new Date().getFullYear()} chessgator</p>
      <ul className="flex shrink-0 items-center gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
