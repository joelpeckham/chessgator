#!/usr/bin/env bun
/**
 * Fetch 50 analyzed amateur Lichess games and dump ChessGator coach copy
 * for every move. Offline QA input — not used at runtime.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreToCpWhite } from "@/domain/analysis/classification";
import {
  pickBenefitReasons,
  pickProblemReasons,
} from "@/domain/analysis/explanation-reasons";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import { collectMoveEffects } from "@/domain/analysis/move-effects";
import type { EvaluationScore } from "@/domain/analysis/types";
import { createChess, tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";
import { selectTeachingInsight } from "@/domain/teaching/select-insight";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, "fixtures", "lichess-game-coaching");
const INDEX_PATH = join(OUT_DIR, "index.json");
const USER_AGENT = "chessgator-coaching-review (local QA dump)";
const TARGET_GAMES = 50;
const MIN_RATING = 1100;
const MAX_RATING = 1800;
const MIN_PLIES = 24;
const MAX_PLIES = 80;
const SEED_USERS = [
  "revoof",
  "habibaram",
  "tymsonek_jelonek",
  "mopanav",
  "kolper",
  "steak_01",
  "shisui",
  "kgndnz",
];

type LichessPlayer = {
  user?: { name?: string; id?: string };
  rating?: number;
};

type LichessAnalysisPly = {
  eval?: number;
  mate?: number;
  best?: string;
  variation?: string;
  judgment?: { name?: string; comment?: string };
};

type LichessGame = {
  id: string;
  rated?: boolean;
  variant?: string;
  speed?: string;
  status?: string;
  winner?: "white" | "black";
  opening?: { name?: string; eco?: string };
  players?: { white?: LichessPlayer; black?: LichessPlayer };
  moves?: string;
  analysis?: LichessAnalysisPly[];
};

export type GameMoveCoaching = {
  ply: number;
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  classification: string;
  concept: string;
  explanation: string;
  reasons: string[];
  suggestedMoveSan: string | null;
  evalBeforeCp: number | null;
  evalAfterCp: number | null;
  evalLossCp: number;
  lichessJudgment: string | null;
};

export type GameCoachingDump = {
  gameId: string;
  white: { name: string; rating: number | null };
  black: { name: string; rating: number | null };
  speed: string;
  opening: string | null;
  result: string;
  moveCount: number;
  moves: GameMoveCoaching[];
};

async function main(): Promise<void> {
  const games = await collectGames(TARGET_GAMES);
  await mkdir(OUT_DIR, { recursive: true });
  const index: Array<{
    gameId: string;
    white: string;
    black: string;
    ratings: string;
    moves: number;
    path: string;
  }> = [];

  for (const game of games) {
    const dump = dumpGame(game);
    if (!dump || dump.moves.length < MIN_PLIES) continue;
    const path = join(OUT_DIR, `${dump.gameId}.json`);
    await writeFile(path, `${JSON.stringify(dump, null, 2)}\n`);
    index.push({
      gameId: dump.gameId,
      white: dump.white.name,
      black: dump.black.name,
      ratings: `${dump.white.rating ?? "?"}-${dump.black.rating ?? "?"}`,
      moves: dump.moves.length,
      path: `scripts/fixtures/lichess-game-coaching/${dump.gameId}.json`,
    });
  }

  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`wrote ${index.length} games → ${OUT_DIR}`);
}

async function collectGames(target: number): Promise<LichessGame[]> {
  const byId = new Map<string, LichessGame>();
  const seenUsers = new Set<string>();
  const queue = [...SEED_USERS];

  while (queue.length > 0 && byId.size < target) {
    const user = queue.shift();
    if (!user || seenUsers.has(user.toLowerCase())) continue;
    seenUsers.add(user.toLowerCase());
    const batch = await fetchUserGames(user);
    console.log(
      `${user}: ${batch.length} games, pool=${byId.size}/${target}, queue=${queue.length}`,
    );
    for (const game of batch) {
      enqueueOpponents(game, queue, seenUsers);
      if (byId.size >= target) continue;
      if (!usableGame(game) || byId.has(game.id)) continue;
      byId.set(game.id, game);
    }
    await sleep(1100);
  }

  if (byId.size < target) {
    throw new Error(`only found ${byId.size} usable analyzed games`);
  }
  return [...byId.values()].slice(0, target);
}

function enqueueOpponents(
  game: LichessGame,
  queue: string[],
  seenUsers: Set<string>,
): void {
  for (const side of [game.players?.white, game.players?.black]) {
    const name = side?.user?.id ?? side?.user?.name;
    const rating = side?.rating;
    if (!name || seenUsers.has(name.toLowerCase())) continue;
    if (rating === undefined || rating < MIN_RATING || rating > MAX_RATING) {
      continue;
    }
    queue.push(name);
  }
}

async function fetchUserGames(user: string): Promise<LichessGame[]> {
  const url = new URL(`https://lichess.org/api/games/user/${user}`);
  url.searchParams.set("max", "50");
  url.searchParams.set("rated", "true");
  url.searchParams.set("analysed", "true");
  url.searchParams.set("evals", "true");
  url.searchParams.set("opening", "true");
  url.searchParams.set("variant", "standard");
  url.searchParams.set("perfType", "blitz,rapid,classical");
  url.searchParams.set("moves", "true");

  const response = await fetch(url, {
    headers: {
      Accept: "application/x-ndjson",
      "User-Agent": USER_AGENT,
    },
  });
  if (response.status === 404) return [];
  if (!response.ok) {
    console.warn(`skip ${user}: HTTP ${response.status}`);
    return [];
  }
  const text = await response.text();
  const games: LichessGame[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    games.push(JSON.parse(line) as LichessGame);
  }
  return games;
}

function usableGame(game: LichessGame): boolean {
  if (game.variant && game.variant !== "standard") return false;
  const sans = game.moves?.trim().split(/\s+/) ?? [];
  const analysis = game.analysis ?? [];
  if (sans.length < MIN_PLIES || sans.length > MAX_PLIES) return false;
  if (analysis.length < sans.length) return false;
  const white = game.players?.white?.rating;
  const black = game.players?.black?.rating;
  if (white === undefined || black === undefined) return false;
  if (white < MIN_RATING || white > MAX_RATING) return false;
  if (black < MIN_RATING || black > MAX_RATING) return false;
  const scored = analysis.filter(
    (ply) => ply.eval !== undefined || ply.mate !== undefined,
  ).length;
  return scored >= sans.length - 1;
}

export function dumpGame(game: LichessGame): GameCoachingDump | null {
  const sans = game.moves?.trim().split(/\s+/) ?? [];
  const analysis = game.analysis ?? [];
  if (sans.length === 0) return null;
  const chess = createChess();
  const moves: GameMoveCoaching[] = [];
  let previousMove: GameMove | null = null;

  for (let i = 0; i < sans.length; i += 1) {
    const san = sans[i];
    if (!san) continue;
    const fenBefore = chess.fen();
    const applied = tryApplyMove(fenBefore, san);
    if (!applied) break;
    chess.load(applied.fenAfter);
    const plyAnalysis = analysis[i];
    const prevAnalysis = i === 0 ? undefined : analysis[i - 1];
    const lastMove = previousMove;
    previousMove = applied.move;
    if (!plyAnalysis) continue;
    const row = dumpMove({
      gameId: game.id,
      ply: i + 1,
      san,
      applied,
      previousMove: lastMove,
      fenBefore,
      plyAnalysis,
      prevAnalysis,
    });
    if (row) moves.push(row);
  }

  const winner = game.winner;
  const result =
    winner === "white" ? "1-0" : winner === "black" ? "0-1" : "1/2-1/2";

  return {
    gameId: game.id,
    white: {
      name: game.players?.white?.user?.name ?? "White",
      rating: game.players?.white?.rating ?? null,
    },
    black: {
      name: game.players?.black?.user?.name ?? "Black",
      rating: game.players?.black?.rating ?? null,
    },
    speed: game.speed ?? "unknown",
    opening: game.opening?.name ?? null,
    result,
    moveCount: moves.length,
    moves,
  };
}

function dumpMove(input: {
  gameId: string;
  ply: number;
  san: string;
  applied: NonNullable<ReturnType<typeof tryApplyMove>>;
  previousMove: GameMove | null;
  fenBefore: string;
  plyAnalysis: LichessAnalysisPly;
  prevAnalysis: LichessAnalysisPly | undefined;
}): GameMoveCoaching | null {
  const afterScore = toScore(input.plyAnalysis);
  const beforeScore = input.prevAnalysis
    ? toScore(input.prevAnalysis)
    : { cp: 25 };
  const playedUci = input.applied.move.uci;
  const bestMoveUci = input.plyAnalysis.best ?? playedUci;
  const bestPv = variationToUci(
    input.fenBefore,
    bestMoveUci,
    input.plyAnalysis.variation,
  );
  const id = `${input.gameId}:ply${input.ply}`;
  const evidence = buildMoveAnalysisEvidence({
    requestId: id,
    gameNodeId: id,
    playedMove: input.applied.move,
    previousMove: input.previousMove,
    fenBefore: input.fenBefore,
    fenAfter: input.applied.fenAfter,
    before: {
      requestId: id,
      gameNodeId: id,
      fen: input.fenBefore,
      sideToMove: input.applied.move.color,
      score: beforeScore,
      bestMoveUci,
      lines: [{ multipv: 1, score: beforeScore, pvUci: bestPv }],
    },
    after: {
      requestId: id,
      gameNodeId: id,
      fen: input.applied.fenAfter,
      sideToMove: input.applied.move.color === "w" ? "b" : "w",
      score: afterScore,
      bestMoveUci: null,
      lines: [{ multipv: 1, score: afterScore, pvUci: [] }],
    },
  });
  const insight = selectTeachingInsight(evidence);
  const effects = collectMoveEffects({
    fenBefore: input.fenBefore,
    move: input.applied.move,
    fenAfter: input.applied.fenAfter,
    previousMove: input.previousMove,
  });
  const reasons = [
    ...pickProblemReasons(effects),
    ...pickBenefitReasons(effects, []),
  ].map((reason) => reason.kind);

  return {
    ply: input.ply,
    san: input.applied.move.san,
    uci: playedUci,
    color: input.applied.move.color,
    fenBefore: input.fenBefore,
    classification: insight.classification,
    concept: insight.concept,
    explanation: insight.explanation,
    reasons,
    suggestedMoveSan: insight.suggestedMoveSan,
    evalBeforeCp: scoreToCpWhite(beforeScore),
    evalAfterCp: scoreToCpWhite(afterScore),
    evalLossCp: evidence.evalLossCp,
    lichessJudgment: input.plyAnalysis.judgment?.name ?? null,
  };
}

function toScore(ply: LichessAnalysisPly): EvaluationScore {
  if (ply.mate !== undefined) return { mate: ply.mate };
  if (ply.eval !== undefined) return { cp: ply.eval };
  return { cp: 0 };
}

function variationToUci(
  fen: string,
  bestMoveUci: string,
  variation: string | undefined,
): string[] {
  if (variation) {
    const fromSan: string[] = [];
    let cursor = fen;
    for (const token of variation.split(/\s+/)) {
      if (!token || /^\d+\.+$/.test(token)) continue;
      const applied = tryApplyMove(cursor, token);
      if (!applied) break;
      fromSan.push(applied.move.uci);
      cursor = applied.fenAfter;
      if (fromSan.length >= 4) break;
    }
    if (fromSan.length > 0) return fromSan;
  }
  return [bestMoveUci];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
