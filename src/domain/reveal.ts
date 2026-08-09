export function canRevealPicks(kickoffAt: Date, now: Date): boolean {
  return now.getTime() >= kickoffAt.getTime();
}
