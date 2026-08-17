import { describe, expect, it } from "vitest";
import { clampMaiaElo, gameHref, parseGameSearch } from "@/lib/game-href";

describe("clampMaiaElo", () => {
  it("rounds to the 100-point ladder and clamps", () => {
    expect(clampMaiaElo(1540)).toBe(1500);
    expect(clampMaiaElo(900)).toBe(1100);
    expect(clampMaiaElo(2100)).toBe(1900);
  });
});

describe("gameHref", () => {
  it("builds a query string from presets", () => {
    expect(gameHref({ elo: 1200, color: "black" })).toBe(
      "/game?elo=1200&color=black",
    );
    expect(gameHref({ moves: ["e4", "e5", "Nf3"] })).toBe(
      "/game?moves=e4%2Ce5%2CNf3",
    );
    expect(gameHref({ moves: ["e4", "e5", "Qh5+"], ply: 2 })).toBe(
      "/game?moves=e4%2Ce5%2CQh5%2B&ply=2",
    );
    expect(gameHref()).toBe("/game");
  });
});

describe("parseGameSearch", () => {
  it("returns null when no preset keys are present", () => {
    expect(parseGameSearch("")).toBeNull();
    expect(parseGameSearch("?utm=1")).toBeNull();
  });

  it("parses elo, color, fen, and moves", () => {
    expect(parseGameSearch("?elo=1240&color=b&moves=e4,e5")).toEqual({
      elo: 1200,
      color: "black",
      moves: ["e4", "e5"],
    });
    expect(parseGameSearch("?moves=e4,e5,Qh5%2B&ply=2")).toEqual({
      moves: ["e4", "e5", "Qh5+"],
      ply: 2,
    });
    expect(parseGameSearch("?fen=8/8/8/8/8/8/8/4K2k+w+-+-+0+1")).toMatchObject({
      fen: "8/8/8/8/8/8/8/4K2k w - - 0 1",
    });
  });
});
