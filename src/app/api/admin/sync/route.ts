import { Effect } from "effect";
import { requireLiveCommissioner } from "@/auth/session";
import { syncSeasonWeeks, syncWeek } from "@/domain/sync";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    await requireLiveCommissioner();
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
