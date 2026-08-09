export function deriveCurrentWeek(
  games: { week: number; status: string }[],
  maxWeek = 18,
): number {
  if (games.length === 0) return 1;
  const byWeek = new Map<number, string[]>();
  for (const g of games) {
    const list = byWeek.get(g.week) ?? [];
    list.push(g.status);
    byWeek.set(g.week, list);
  }
  for (let w = 1; w <= maxWeek; w++) {
    const statuses = byWeek.get(w);
    if (!statuses) continue;
    if (statuses.some((s) => s !== "final")) return w;
  }
  const weeks = [...byWeek.keys()];
  return Math.min(maxWeek, Math.max(...weeks));
}

export function getSeasonYear(): number {
  const y = Number(process.env.SEASON_YEAR);
  return Number.isFinite(y) && y >= 2000 ? y : new Date().getUTCFullYear();
}
