export type GameStatus = "scheduled" | "in_progress" | "final";

export function scorePick(args: {
  pickedTeam: string | null;
  winnerTeam: string | null;
  status: GameStatus;
}): 0 | 1 | null {
  if (args.status !== "final") return null;
  if (!args.winnerTeam) return 0;
  if (!args.pickedTeam) return 0;
  return args.pickedTeam === args.winnerTeam ? 1 : 0;
}

export function aggregateUserPoints(
  games: { id: string; status: GameStatus; winnerTeam: string | null }[],
  picksByGameId: Map<string, string>,
): number {
  let total = 0;
  for (const g of games) {
    const s = scorePick({
      pickedTeam: picksByGameId.get(g.id) ?? null,
      winnerTeam: g.winnerTeam,
      status: g.status,
    });
    if (s !== null) total += s;
  }
  return total;
}
