import type { CSSProperties } from "react";

export function buildSquareStyles(args: {
  lastMove: { from: string; to: string } | null;
  highlightSquares: ReadonlySet<string>;
  ghostSquares: ReadonlySet<string>;
  selectedSquare: string | null;
  destinations: ReadonlySet<string>;
  isCheck: boolean;
  checkSquare: string | null;
}): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};

  if (args.lastMove) {
    styles[args.lastMove.from] = {
      background: "color-mix(in oklch, var(--primary) 18%, transparent)",
      outline: "2px solid color-mix(in oklch, var(--primary) 55%, transparent)",
      outlineOffset: "-2px",
    };
    styles[args.lastMove.to] = {
      background: "color-mix(in oklch, var(--primary) 28%, transparent)",
      outline: "2px solid color-mix(in oklch, var(--primary) 70%, transparent)",
      outlineOffset: "-2px",
    };
  }

  for (const square of args.highlightSquares) {
    styles[square] = {
      ...styles[square],
      outline: "2px dashed var(--foreground)",
      outlineOffset: "-3px",
      background:
        styles[square]?.background ??
        "color-mix(in oklch, var(--accent) 22%, transparent)",
    };
  }

  for (const square of args.ghostSquares) {
    styles[square] = {
      ...styles[square],
      outline: "2px dotted var(--foreground)",
      outlineOffset: "-4px",
      background:
        styles[square]?.background ??
        "color-mix(in oklch, var(--muted) 70%, transparent)",
    };
  }

  if (args.selectedSquare) {
    styles[args.selectedSquare] = {
      ...styles[args.selectedSquare],
      outline: "2px dashed var(--foreground)",
      outlineOffset: "-4px",
    };
  }

  for (const square of args.destinations) {
    styles[square] = {
      ...styles[square],
      outline:
        styles[square]?.outline ??
        "2px solid color-mix(in oklch, var(--foreground) 35%, transparent)",
      outlineOffset: "-2px",
    };
  }

  if (args.isCheck && args.checkSquare) {
    styles[args.checkSquare] = {
      ...styles[args.checkSquare],
      background: "color-mix(in oklch, var(--destructive) 35%, transparent)",
      outline: "2px solid var(--destructive)",
      outlineOffset: "-2px",
    };
  }

  return styles;
}
