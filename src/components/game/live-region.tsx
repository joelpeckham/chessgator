"use client";

export type LiveRegionProps = {
  message: string;
};

/** Polite live region for move and status announcements. */
export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="live-region"
    >
      {message}
    </div>
  );
}
