import { Effect } from "effect";
import { requireLiveCommissioner } from "@/auth/session";
import { ValidationError } from "@/domain/errors";
import { getGamesForWeek } from "@/domain/sync";
import { jsonOk, mapDomainError } from "@/lib/api";

function kickoffMs(kickoffAt: Date | string | number): number {
  if (kickoffAt instanceof Date) return kickoffAt.getTime();
  return new Date(kickoffAt).getTime();
}

function kickoffIso(kickoffAt: Date | string | number): string {
  if (kickoffAt instanceof Date) return kickoffAt.toISOString();
  return new Date(kickoffAt).toISOString();
}

export async function GET(req: Request) {
  try {
    await requireLiveCommissioner();
    const week = Number(new URL(req.url).searchParams.get("week"));
    if (!Number.isInteger(week) || week < 1 || week > 18) {
      throw new ValidationError({
        message: "week must be an integer from 1 to 18",
      });
    }
    const rows = await Effect.runPromise(getGamesForWeek(week));
    const games = [...rows]
      .sort((a, b) => kickoffMs(a.kickoffAt) - kickoffMs(b.kickoffAt))
      .map((g) => ({
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        kickoffAt: kickoffIso(g.kickoffAt),
        winnerTeam: g.winnerTeam,
        status: g.status,
      }));
    return jsonOk({ games });
  } catch (e) {
    return mapDomainError(e);
  }
}
