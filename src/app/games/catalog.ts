import annotated from "@/app/games/data/games.json";
import { SOURCE_GAMES } from "@/app/games/data/source";
import type { FamousGame } from "@/app/games/data/types";
import { fenSideToMove, isTerminalFen } from "@/lib/fen-from-moves";

const annotatedGames = annotated as FamousGame[];

const bySlug = new Map(annotatedGames.map((game) => [game.slug, game]));

export function listGames(): FamousGame[] {
  return SOURCE_GAMES.map((source) => {
    const game = bySlug.get(source.slug);
    if (!game) {
      throw new Error(`Missing annotated game for slug "${source.slug}"`);
    }
    return game;
  });
}

export type TakeOverSeat = {
  /** 1-based ply of the position the visitor sits on. */
  ply: number;
  fen: string;
  color: "white" | "black";
};

export function plyFen(game: FamousGame, ply: number): string {
  if (ply < 1 || ply > game.plies.length) {
    throw new Error(`Ply ${ply} out of range for ${game.slug}`);
  }
  const fen = game.plies[ply - 1]?.fenAfter;
  if (!fen) {
    throw new Error(`Missing FEN at ply ${ply} for ${game.slug}`);
  }
  return fen;
}

/**
 * Seat the visitor as `takeOverColor`. When that side already moved on
 * `criticalPly`, sit one ply earlier so they play the famous move themselves.
 */
export function takeOverSeat(game: FamousGame): TakeOverSeat {
  const afterCritical = plyFen(game, game.criticalPly);
  const sideAfter = fenSideToMove(afterCritical);
  const ply =
    game.takeOverColor === sideAfter ? game.criticalPly : game.criticalPly - 1;
  const fen = plyFen(game, ply);
  const color = fenSideToMove(fen);
  if (color !== game.takeOverColor) {
    throw new Error(
      `takeOverColor ${game.takeOverColor} is not to move at ply ${ply} for ${game.slug}`,
    );
  }
  if (isTerminalFen(fen)) {
    throw new Error(`Take-over position is terminal for ${game.slug}`);
  }
  return { ply, fen, color };
}

for (const game of listGames()) {
  takeOverSeat(game);
}

export function findGame(slug: string): FamousGame | undefined {
  return listGames().find((game) => game.slug === slug);
}

export function gameStaticParams(): { slug: string }[] {
  return SOURCE_GAMES.map((game) => ({ slug: game.slug }));
}

export function gamePaths(): string[] {
  return ["/games", ...SOURCE_GAMES.map((game) => `/games/${game.slug}`)];
}
