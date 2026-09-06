import { Effect } from "effect";
import { requireLiveCommissioner } from "@/auth/session";
import { overrideWinner } from "@/domain/sync";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    await requireLiveCommissioner();
    const body = (await req.json()) as {
      gameId?: string;
      winnerTeam?: string | null;
    };
    const result = await Effect.runPromise(
      overrideWinner(body.gameId ?? "", body.winnerTeam ?? null),
    );
    return jsonOk(result);
  } catch (e) {
    return mapDomainError(e);
  }
}
