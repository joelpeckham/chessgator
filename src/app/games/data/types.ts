export type MoveClassification =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export type GamePly = {
  san: string;
  fenAfter: string;
  classification?: MoveClassification;
  comment?: string;
};

export type GameSource = {
  slug: string;
  title: string;
  white: string;
  black: string;
  event: string;
  year: number;
  result: string;
  intro: string;
  hook: string;
  /** 1-based ply of the famous moment. Take-over may sit one ply earlier. */
  criticalPly: number;
  takeOverColor: "white" | "black";
  takeOverElo: number;
  pgn: string;
  /** Comments keyed by 1-based ply number. */
  comments: Record<string, string>;
};

export type FamousGame = Omit<GameSource, "pgn" | "comments"> & {
  pgn: string;
  plies: GamePly[];
};
