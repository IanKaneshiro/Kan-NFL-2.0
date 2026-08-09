import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Forbidden, Unauthorized } from "@/domain/errors";
import { issueSetupToken } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    if (session.role !== "commissioner") throw new Forbidden({});
    const body = (await req.json()) as { userId?: string };
    const result = await Effect.runPromise(issueSetupToken(body.userId ?? ""));
    return jsonOk({
      rawToken: result.rawToken,
      url: result.setupPath,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (e) {
    return mapDomainError(e);
  }
}
