export function boardSurfaceOptions(args?: { transparent?: boolean }): {
  boardStyle: {
    backgroundColor?: string;
    borderRadius: string;
    width: string;
  };
  darkSquareStyle: { backgroundColor: string };
  lightSquareStyle: { backgroundColor: string };
  darkSquareNotationStyle: { color: string; fontWeight: number };
  lightSquareNotationStyle: { color: string; fontWeight: number };
  alphaNotationStyle: { color: string; fontWeight: number };
  numericNotationStyle: { color: string; fontWeight: number };
} {
  return {
    boardStyle: {
      ...(args?.transparent ? { backgroundColor: "transparent" } : {}),
      borderRadius: "var(--radius)",
      width: "100%",
    },
    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
    lightSquareStyle: { backgroundColor: "var(--board-light)" },
    darkSquareNotationStyle: {
      color: "var(--board-light)",
      fontWeight: 700,
    },
    lightSquareNotationStyle: {
      color: "var(--foreground)",
      fontWeight: 700,
    },
    alphaNotationStyle: { color: "var(--foreground)", fontWeight: 700 },
    numericNotationStyle: { color: "var(--foreground)", fontWeight: 700 },
  };
}
