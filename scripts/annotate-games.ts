#!/usr/bin/env bun
/**
 * Parse famous-game PGNs, attach original comments, and optionally classify
 * each ply with Stockfish. Writes src/app/games/data/games.json.
 *
 *   bun scripts/annotate-games.ts
 *   bun scripts/annotate-games.ts --engine
 *   bun scripts/annotate-games.ts --engine --depth 10 --limit 5
 */
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE_GAMES } from "../src/app/games/data/source";
import type {
  FamousGame,
  GamePly,
  MoveClassification,
} from "../src/app/games/data/types";
import {
  classifyPlayedMove,
  evalLossForMover,
} from "../src/domain/analysis/classification";
import { scoreFromSideToMove } from "../src/domain/analysis/score";
import type { EvaluationScore } from "../src/domain/analysis/types";
import { parsePgn } from "../src/domain/game/pgn-import";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const OUT = join(ROOT, "src/app/games/data/games.json");
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ENGINE_JS = join(ROOT, "node_modules/stockfish/bin/stockfish-18-asm.js");

type EvalResult = {
  score: EvaluationScore;
  bestMoveUci: string | null;
};

function parseArgs(argv: string[]) {
  const args = {
    engine: argv.includes("--engine"),
    depth: 10,
    limit: Number.POSITIVE_INFINITY,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--depth" && next) {
      args.depth = Number.parseInt(next, 10) || 10;
    }
    if (token === "--limit" && next) {
      args.limit = Number.parseInt(next, 10) || Number.POSITIVE_INFINITY;
    }
  }
  return args;
}

function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

function parseInfoScore(line: string): EvaluationScore | null {
  const mate = /\bscore mate (-?\d+)\b/.exec(line);
  if (mate?.[1]) return { mate: Number.parseInt(mate[1], 10) };
  const cp = /\bscore cp (-?\d+)\b/.exec(line);
  if (cp?.[1]) return { cp: Number.parseInt(cp[1], 10) };
  return null;
}

function parseBestMove(line: string): string | null {
  const match = /^bestmove (\S+)/.exec(line);
  if (!match?.[1] || match[1] === "(none)") return null;
  return match[1].toLowerCase();
}

class StockfishSession {
  private readonly child;
  private buffer = "";
  private readonly lines: string[] = [];
  private waiter: ((line: string) => void) | null = null;

  constructor() {
    this.child = spawn("node", [ENGINE_JS], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.resume();
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      let newline = this.buffer.indexOf("\n");
      while (newline >= 0) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (line) this.pushLine(line);
        newline = this.buffer.indexOf("\n");
      }
    });
  }

  private pushLine(line: string) {
    if (this.waiter) {
      const wait = this.waiter;
      this.waiter = null;
      wait(line);
      return;
    }
    this.lines.push(line);
  }

  private send(command: string) {
    this.child.stdin.write(`${command}\n`);
  }

  private nextLine(): Promise<string> {
    return new Promise((resolve) => {
      const queued = this.lines.shift();
      if (queued !== undefined) {
        resolve(queued);
        return;
      }
      this.waiter = resolve;
    });
  }

  private async waitFor(predicate: (line: string) => boolean): Promise<string> {
    for (;;) {
      const line = await this.nextLine();
      if (predicate(line)) return line;
    }
  }

  async init(): Promise<void> {
    this.send("uci");
    await this.waitFor((line) => line === "uciok");
    this.send("setoption name Hash value 64");
    this.send("isready");
    await this.waitFor((line) => line === "readyok");
    console.log("stockfish ready");
  }

  async evaluate(fen: string, depth: number): Promise<EvalResult> {
    this.send("ucinewgame");
    this.send("isready");
    await this.waitFor((line) => line === "readyok");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    let score: EvaluationScore = { cp: 0 };
    let bestMoveUci: string | null = null;
    for (;;) {
      const line = await this.nextLine();
      const info = parseInfoScore(line);
      if (info) score = info;
      const best = parseBestMove(line);
      if (best !== null || line.startsWith("bestmove")) {
        bestMoveUci = best;
        break;
      }
    }
    return { score, bestMoveUci };
  }

  async close(): Promise<void> {
    this.send("quit");
    this.child.kill();
  }
}

function assertCommentKeys(
  source: (typeof SOURCE_GAMES)[number],
  plyCount: number,
): void {
  for (const key of Object.keys(source.comments)) {
    const ply = Number(key);
    if (!Number.isInteger(ply) || ply < 1 || ply > plyCount) {
      throw new Error(
        `Comment key "${key}" out of range for ${source.slug} (1–${plyCount})`,
      );
    }
  }
}

function buildUnclassified(source: (typeof SOURCE_GAMES)[number]): FamousGame {
  const parsed = parsePgn(source.pgn);
  if (!parsed || parsed.moves.length === 0) {
    throw new Error(`Could not parse PGN for ${source.slug}`);
  }
  assertCommentKeys(source, parsed.moves.length);
  const plies: GamePly[] = parsed.moves.map((move, index) => {
    const comment = source.comments[String(index + 1)];
    return {
      san: move.san,
      fenAfter: move.fenAfter,
      ...(comment ? { comment } : {}),
    };
  });
  return {
    slug: source.slug,
    title: source.title,
    white: source.white,
    black: source.black,
    event: source.event,
    year: source.year,
    result: source.result,
    intro: source.intro,
    hook: source.hook,
    criticalPly: source.criticalPly,
    takeOverColor: source.takeOverColor,
    takeOverElo: source.takeOverElo,
    pgn: source.pgn,
    plies,
  };
}

function classifyPly(input: {
  fenBefore: string;
  playedUci: string;
  before: EvalResult;
  after: EvalResult;
}): MoveClassification {
  const mover = sideToMove(input.fenBefore);
  const afterSide = mover === "w" ? "b" : "w";
  const lossCp = evalLossForMover({
    evalBeforeWhite: scoreFromSideToMove(input.before.score, mover),
    evalAfterWhite: scoreFromSideToMove(input.after.score, afterSide),
    mover,
  });
  return classifyPlayedMove({
    lossCp,
    playedUci: input.playedUci,
    bestMoveUci: input.before.bestMoveUci,
  });
}

async function annotateWithEngine(
  game: FamousGame,
  parsedMoves: { uci: string; fenAfter: string }[],
  engine: StockfishSession,
  depth: number,
): Promise<FamousGame> {
  const fens = [START_FEN, ...parsedMoves.map((move) => move.fenAfter)];
  const evals: EvalResult[] = [];
  for (const [index, fen] of fens.entries()) {
    process.stdout.write(`  ${game.slug} ${index + 1}/${fens.length}\r`);
    evals.push(await engine.evaluate(fen, depth));
  }
  process.stdout.write("\n");
  const plies = game.plies.map((ply, index) => {
    const fenBefore = fens[index] ?? START_FEN;
    const played = parsedMoves[index];
    const before = evals[index];
    const after = evals[index + 1];
    if (!played || !before || !after) return ply;
    const classification = classifyPly({
      fenBefore,
      playedUci: played.uci,
      before,
      after,
    });
    return { ...ply, classification };
  });
  return { ...game, plies };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const games: FamousGame[] = [];
  for (const source of SOURCE_GAMES) {
    games.push(buildUnclassified(source));
  }

  let engineRan = false;
  if (args.engine) {
    const engine = new StockfishSession();
    try {
      await engine.init();
      engineRan = true;
      const limit = Math.min(args.limit, games.length);
      for (let i = 0; i < limit; i += 1) {
        const game = games[i];
        if (!game) continue;
        const parsed = parsePgn(game.pgn);
        if (!parsed) throw new Error(`reparse failed: ${game.slug}`);
        console.log(`annotating ${game.slug} (${parsed.moves.length} plies)`);
        games[i] = await annotateWithEngine(
          game,
          parsed.moves,
          engine,
          args.depth,
        );
      }
    } finally {
      await engine.close();
    }
  }

  await writeFile(OUT, `${JSON.stringify(games, null, 2)}\n`);
  const classified = games.filter((game) =>
    game.plies.some((ply) => ply.classification),
  ).length;
  console.log(
    `wrote ${games.length} games (${classified} with engine labels) → ${OUT}`,
  );
  console.log(`stockfish ran: ${engineRan}`);
}

await main();
