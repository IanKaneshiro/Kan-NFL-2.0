export function isGameLocked(kickoffAt: Date, now: Date): boolean {
  return now.getTime() >= kickoffAt.getTime();
}
