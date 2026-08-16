import Link from "next/link";

export function ChessgatorWordmark({ href }: { href?: string }) {
  const mark = (
    <p className="font-heading text-base font-semibold tracking-tight sm:text-lg">
      chessgator
    </p>
  );
  if (!href) return mark;
  return (
    <Link
      href={href}
      className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
    >
      {mark}
    </Link>
  );
}
