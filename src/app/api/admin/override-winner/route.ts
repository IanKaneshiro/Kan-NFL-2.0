import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Forbidden, Unauthorized } from "@/domain/errors";
import { overrideWinner } from "@/domain/sync";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    if (session.role !== "commissioner") throw new Forbidden({});
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
