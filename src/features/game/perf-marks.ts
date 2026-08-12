/**
 * Lightweight performance marks for engine startup / analysis.
 * No external analytics — DevTools Performance panel only.
 */

function hasPerformance(): boolean {
  return (
    typeof performance !== "undefined" &&
    typeof performance.mark === "function" &&
    typeof performance.measure === "function"
  );
}

export function markStart(name: string): void {
  if (!hasPerformance()) return;
  try {
    performance.mark(`${name}:start`);
  } catch {
    // ignore duplicate / unsupported mark errors
  }
}

export function markEnd(name: string): void {
  if (!hasPerformance()) return;
  try {
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
  } catch {
    // start mark may be missing if cancelled
  }
}
