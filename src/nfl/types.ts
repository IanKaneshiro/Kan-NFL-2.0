export type NormalizedGame = {
  externalId: string;
  seasonYear: number;
  week: number;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  homeName?: string;
  awayName?: string;
  status: "scheduled" | "in_progress" | "final";
  winnerTeam: string | null;
};
