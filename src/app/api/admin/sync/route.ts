import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Forbidden, Unauthorized } from "@/domain/errors";
import { syncSeasonWeeks, syncWeek } from "@/domain/sync";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    if (session.role !== "commissioner") throw new Forbidden({});
    const body = (await req.json().catch(() => ({}))) as { week?: number };
    if (body.week !== undefined) {
      const result = await Effect.runPromise(syncWeek(Number(body.week)));
      return jsonOk({ results: [result] });
    }
    const results = await Effect.runPromise(syncSeasonWeeks());
    return jsonOk({ results });
  } catch (e) {
    return mapDomainError(e);
  }
}
