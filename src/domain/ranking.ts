export function competitionRanks(
  rows: { userId: string; points: number; displayName: string }[],
): { userId: string; points: number; displayName: string; rank: number }[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.displayName.localeCompare(b.displayName);
  });
  let lastPoints: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    if (lastPoints === null || row.points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = row.points;
    }
    return { ...row, rank: lastRank };
  });
}
