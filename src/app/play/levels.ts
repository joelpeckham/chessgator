export type PlayLevel = {
  elo: number;
  slug: string;
  label: string;
  hubBlurb: string;
  description: string;
  paragraphs: readonly string[];
};

export const PLAY_LEVELS: readonly PlayLevel[] = [
  {
    elo: 1100,
    slug: "newcomer",
    label: "Newcomer",
    hubBlurb:
      "You know how the pieces move and want a patient opponent while you learn basic patterns.",
    description:
      "Play chess against a 1100 Elo Maia bot. A human-like opponent for newcomers still learning how pieces work together.",
    paragraphs: [
      "A 1100-rated opponent suits players who are past the absolute basics but still building confidence. Games tend to be slower and more forgiving, with fewer deep combinations to calculate.",
      "Maia is a neural network trained on real human games at each rating band, so its mistakes and priorities feel like a person at your level—not an engine hunting forced wins from move one.",
      "On chessgator you still get local coaching after your moves: Stockfish runs in the browser and the coach explains what you played and what was stronger. You can replay lines without leaving the page.",
    ],
  },
  {
    elo: 1200,
    slug: "beginner",
    label: "Beginner",
    hubBlurb:
      "You can finish games but still miss one-move threats and simple forks.",
    description:
      "Play chess against a 1200 Elo Maia bot. Human-like play for beginners who know the rules and want steady practice.",
    paragraphs: [
      "At 1200 Elo you can expect occasional tactical slips and straightforward plans. It is a good step up from the newcomer tier when you want a bit more resistance without long theoretical lines.",
      "Maia at this strength picks moves that match how humans actually play online at 1200—not the perfect refutations a traditional engine would choose.",
      "Start a game with one click. No account is required. Coaching analysis still runs locally after each of your moves so you can see why a different idea might have worked better.",
    ],
  },
  {
    elo: 1300,
    slug: "casual",
    label: "Casual",
    hubBlurb:
      "You play now and then and want a relaxed opponent that still punishes big blunders.",
    description:
      "Play chess against a 1300 Elo Maia bot. A casual-strength human-like opponent for occasional players.",
    paragraphs: [
      "1300 Elo sits in the range of many recreational online players. Positions stay understandable, but you will need to watch for hanging pieces and basic tactics.",
      "Because Maia learned from human games at this rating, its style is recognizable: practical moves, familiar pawn structures, and mistakes that look like yours—not computer-only traps.",
      "chessgator keeps the coach turned on at every strength. You play Maia; Stockfish reviews your choices locally and suggests clearer plans when you ask.",
    ],
  },
  {
    elo: 1400,
    slug: "club",
    label: "Club",
    hubBlurb:
      "You belong to a club or school team and have played a few rated games.",
    description:
      "Play chess against a 1400 Elo Maia bot. Club-level human-like opposition for players with some tournament experience.",
    paragraphs: [
      "1400 Elo is a common club-player rating. You should expect more consistent development, fewer gross blunders, and occasional tactical shots that require real calculation.",
      "Maia mirrors how humans play at this level rather than offering engine-perfect defense. That makes practice games feel closer to a club night or an online rapid session.",
      "Use the built-in coach to compare your move with Stockfish’s line. You can step back in the game tree and try alternatives without resetting the whole session.",
    ],
  },
  {
    elo: 1500,
    slug: "intermediate",
    label: "Intermediate",
    hubBlurb:
      "You have a favorite opening and usually see two-move combinations coming.",
    description:
      "Play chess against a 1500 Elo Maia bot. Intermediate-strength human-like play for improving club players.",
    paragraphs: [
      "At 1500 Elo both sides need reasonable opening knowledge and alert tactics. Positions can open up quickly if either player slips on a fork or pin.",
      "Maia’s 1500 model was trained on games from players near this rating, so its middlegame choices feel familiar—active piece play, practical exchanges, human time-pressure errors.",
      "chessgator runs Maia3 in your browser with no sign-up. Coaching still runs after your moves, so you can study ideas even when the opponent is stronger than your usual sparring partner.",
    ],
  },
  {
    elo: 1600,
    slug: "experienced",
    label: "Experienced",
    hubBlurb:
      "You are a strong club player who rarely hangs material in the opening.",
    description:
      "Play chess against a 1600 Elo Maia bot. Experienced-level human-like opposition for solid club competitors.",
    paragraphs: [
      "1600 Elo demands accurate opening play and steady calculation. Your opponent will capitalize on loose squares and passive piece placement more reliably than at lower tiers.",
      "Maia gives you human-style resistance: ambitious plans, realistic inaccuracies, and endgames that resemble online rated games—not the cold perfection of a top engine.",
      "Every game on chessgator includes local coaching analysis. Review your critical moments with Stockfish and the coach mascot without sending your moves to a server.",
    ],
  },
  {
    elo: 1700,
    slug: "advanced",
    label: "Advanced",
    hubBlurb:
      "You compete in long time controls and are comfortable in sharp middlegames.",
    description:
      "Play chess against a 1700 Elo Maia bot. Advanced human-like play for competitive club and online players.",
    paragraphs: [
      "1700 Elo is serious territory. Opening prep matters, tactics are sharper, and small positional slips can snowball over the next several moves.",
      "Maia at this strength still plays like a person at 1700—not Stockfish. That makes it useful when you want practice that transfers to human opponents rather than engine sparring.",
      "Launch a game instantly from this page. chessgator loads Maia3 via ONNX and WebAssembly in the browser; coaching analysis stays on your device throughout the session.",
    ],
  },
  {
    elo: 1800,
    slug: "expert",
    label: "Expert",
    hubBlurb:
      "You are expert-rated and want human-like resistance without engine absurdity.",
    description:
      "Play chess against a 1800 Elo Maia bot. Expert-level human-like opposition for strong tournament players.",
    paragraphs: [
      "1800 Elo opponents punish imprecision quickly. You will need sound plans, accurate calculation, and awareness of typical pawn breaks and piece maneuvers at this level.",
      "Maia’s expert model reflects how strong human players actually decide: practical sacrifices, familiar structures, and errors that happen in real games—not only tablebase-perfect endgames.",
      "chessgator pairs this opponent with local Stockfish coaching so you can dissect critical positions after the game or mid-session by stepping through alternative lines.",
    ],
  },
  {
    elo: 1900,
    slug: "expert-plus",
    label: "Expert+",
    hubBlurb:
      "You want the strongest human-like opponent Maia offers on chessgator.",
    description:
      "Play chess against a 1900 Elo Maia bot. The top human-like Maia strength for expert players seeking a stiff test.",
    paragraphs: [
      "1900 Elo is the highest Maia tier on chessgator. Expect demanding openings, sustained pressure, and fewer free points from one-move blunders.",
      "Even here Maia plays like a strong human, not an engine tuned for maximum Elo. That difference matters when you are training for over-the-board or online rated events against people.",
      "You can also play Maia on Lichess; chessgator adds browser-local coaching so every move you make can be reviewed with Stockfish without an account or server upload.",
    ],
  },
];

export function findPlayLevel(level: string): PlayLevel | undefined {
  const numeric = Number(level);
  if (Number.isFinite(numeric)) {
    return PLAY_LEVELS.find((entry) => entry.elo === numeric);
  }
  return PLAY_LEVELS.find((entry) => entry.slug === level);
}

export function levelStaticParams(): { level: string }[] {
  return PLAY_LEVELS.flatMap((entry) => [
    { level: String(entry.elo) },
    { level: entry.slug },
  ]);
}

export function playContentPaths(): string[] {
  return ["/play", ...PLAY_LEVELS.map((entry) => `/play/${entry.slug}`)];
}
