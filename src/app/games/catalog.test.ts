import { describe, expect, it } from "vitest";
import { findGame, listGames, takeOverSeat } from "@/app/games/catalog";
import { SOURCE_GAMES } from "@/app/games/data/source";

describe("takeOverSeat", () => {
  it("seats Opera Game as White after the setup, not in mate", () => {
    const game = findGame("opera-game");
    expect(game).toBeDefined();
    const seat = takeOverSeat(game!);
    expect(seat.color).toBe("white");
    expect(seat.ply).toBe(32);
    expect(game!.plies[seat.ply - 1]?.san).toBe("Nxb8");
  });

  it("seats Immortal Game before Be7# so White can play the mate", () => {
    const game = findGame("immortal-game");
    expect(game).toBeDefined();
    const seat = takeOverSeat(game!);
    expect(seat.color).toBe("white");
    expect(seat.ply).toBe(44);
    expect(game!.plies[44]?.san).toBe("Be7#");
  });

  it("seats Game of the Century as Black so the visitor plays 17...Be6", () => {
    const game = findGame("game-of-the-century");
    expect(game).toBeDefined();
    const seat = takeOverSeat(game!);
    expect(seat.color).toBe("black");
    expect(seat.ply).toBe(33);
    expect(game!.plies[33]?.san).toBe("Be6");
  });

  it("keeps every source comment on a real ply", () => {
    const games = listGames();
    for (const source of SOURCE_GAMES) {
      const game = games.find((entry) => entry.slug === source.slug);
      expect(game).toBeDefined();
      for (const key of Object.keys(source.comments)) {
        const ply = Number(key);
        expect(Number.isInteger(ply)).toBe(true);
        expect(ply).toBeGreaterThanOrEqual(1);
        expect(ply).toBeLessThanOrEqual(game!.plies.length);
      }
    }
  });

  it("gives every famous game a playable take-over seat", () => {
    for (const game of listGames()) {
      const seat = takeOverSeat(game);
      expect(seat.color).toBe(game.takeOverColor);
      expect(seat.ply).toBeGreaterThan(0);
      expect(seat.ply).toBeLessThanOrEqual(game.plies.length);
    }
  });
});
