export type MaiaEloOption = {
  elo: number;
  label: string;
};

export const MAIA_ELO_OPTIONS: readonly MaiaEloOption[] = [
  { elo: 1100, label: "Newcomer" },
  { elo: 1200, label: "Beginner" },
  { elo: 1300, label: "Casual" },
  { elo: 1400, label: "Club" },
  { elo: 1500, label: "Intermediate" },
  { elo: 1600, label: "Experienced" },
  { elo: 1700, label: "Advanced" },
  { elo: 1800, label: "Expert" },
  { elo: 1900, label: "Expert+" },
];

export function formatMaiaElo(elo: number): string {
  const match = MAIA_ELO_OPTIONS.find((option) => option.elo === elo);
  return match ? `${match.elo} · ${match.label}` : String(elo);
}

export const MAIA_ELO_ITEMS = Object.fromEntries(
  MAIA_ELO_OPTIONS.map((option) => [
    String(option.elo),
    formatMaiaElo(option.elo),
  ]),
);
