import { createChess, DEFAULT_POSITION, getStatus } from "@/domain/game/rules";
import type { GameMove, GameStatus } from "@/domain/game/types";

export function pgnResultTag(result: GameStatus["result"]): string {
  switch (result) {
    case "whiteWins":
      return "1-0";
    case "blackWins":
      return "0-1";
    case "draw":
      return "1/2-1/2";
    default:
      return "*";
  }
}

/** Replay SAN/UCI history onto a fresh board and emit a minimal PGN. */
export function movesToPgn(args: {
  rootFen?: string;
  moves: readonly GameMove[];
  result?: GameStatus["result"];
}): string {
  const rootFen = args.rootFen ?? DEFAULT_POSITION;
  const chess = createChess(rootFen);
  for (const move of args.moves) {
    chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
  }
  const result = args.result ?? getStatus(chess.fen()).result;
  if (rootFen !== DEFAULT_POSITION) {
    chess.setHeader("SetUp", "1");
    chess.setHeader("FEN", rootFen);
  }
  chess.setHeader("Result", pgnResultTag(result));
  return chess.pgn();
}
