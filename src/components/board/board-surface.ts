export function boardSurfaceOptions(args?: { transparent?: boolean }): {
  boardStyle: {
    backgroundColor?: string;
    borderRadius: string;
    width: string;
  };
  darkSquareStyle: { backgroundColor: string };
  lightSquareStyle: { backgroundColor: string };
} {
  return {
    boardStyle: {
      ...(args?.transparent ? { backgroundColor: "transparent" } : {}),
      borderRadius: "var(--radius)",
      width: "100%",
    },
    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
    lightSquareStyle: { backgroundColor: "var(--board-light)" },
  };
}
