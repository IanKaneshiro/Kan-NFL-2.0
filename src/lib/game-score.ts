/** Score shown beside a team abbreviation. Hidden until the game is live or final. */
export function visibleTeamScore(
  status: string,
  score: number | null | undefined,
): number | null {
  if (status !== "final" && status !== "in_progress") return null;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return score;
}
