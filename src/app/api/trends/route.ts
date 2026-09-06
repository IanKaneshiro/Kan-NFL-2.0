import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { getDb, schemaTables } from "@/db";
import { Unauthorized, ValidationError } from "@/domain/errors";
import { deriveCurrentWeek, getSeasonYear } from "@/domain/season";
import { getWeekTrends } from "@/domain/trends";
import { jsonOk, mapDomainError } from "@/lib/api";

async function resolveWeek(weekParam: string | null): Promise<number> {
  if (weekParam != null && weekParam !== "") {
    const week = Number(weekParam);
    if (!Number.isInteger(week) || week < 1 || week > 18) {
      throw new ValidationError({ message: "week must be an integer from 1 to 18" });
    }
    return week;
  }

  const seasonYear = getSeasonYear();
  const db = getDb();
  const t = schemaTables();
  const games = await db
    .select({ week: t.games.week, status: t.games.status })
    .from(t.games)
    .where(eq(t.games.seasonYear, seasonYear));
  return deriveCurrentWeek(games);
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const url = new URL(req.url);
    const week = await resolveWeek(url.searchParams.get("week"));
    const payload = await Effect.runPromise(getWeekTrends(week));
    return jsonOk(payload);
  } catch (e) {
    return mapDomainError(e);
  }
}
