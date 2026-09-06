import { Effect } from "effect";
import { requireLiveCommissioner } from "@/auth/session";
import { issueSetupToken } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    await requireLiveCommissioner();
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
