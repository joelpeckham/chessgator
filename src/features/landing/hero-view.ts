import { type Color, DEFAULT_POSITION, type SessionMode } from "@/domain/game";
import { deriveBoardInteractivity } from "@/features/game/turn-controller";

export type HeroBoardView = {
  fen: string;
  interactive: boolean;
  gameOver: boolean;
};

/**
 * The hero board ignores the shared game store until the visitor plays a
 * move here: a leftover /game session (or a saved game about to hydrate
 * there) must not lock or repaint the landing demo. Before the first hero
 * move it shows the starting position and stays interactive; afterwards it
 * mirrors the live session like the full board does.
 */
export function heroBoardView(args: {
  started: boolean;
  liveMode: SessionMode;
  liveFen: string;
  humanColor: Color;
  maiaFailed: boolean;
}): HeroBoardView {
  if (!args.started) {
    return {
      fen: DEFAULT_POSITION,
      interactive: !args.maiaFailed,
      gameOver: false,
    };
  }
  return {
    fen: args.liveFen,
    interactive: deriveBoardInteractivity({
      liveMode: args.liveMode,
      liveFen: args.liveFen,
      humanColor: args.humanColor,
      maiaFailed: args.maiaFailed,
    }),
    gameOver: args.liveMode === "gameOver",
  };
}
