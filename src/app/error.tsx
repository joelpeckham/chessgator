"use client";

import { SiteCrash } from "@/components/site-crash";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SiteCrash title="Something went off the board." onRetry={reset} />;
}
