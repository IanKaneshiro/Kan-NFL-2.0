import { Effect } from "effect";
import { requireLiveCommissioner } from "@/auth/session";
import { createUser, listUsers } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function GET() {
  try {
    await requireLiveCommissioner();
    const users = await Effect.runPromise(listUsers());
    return jsonOk({ users });
  } catch (e) {
    return mapDomainError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireLiveCommissioner();
    const body = (await req.json()) as {
      email?: string;
      displayName?: string;
      role?: "player" | "commissioner";
    };
    const user = await Effect.runPromise(
      createUser({
        email: body.email ?? "",
        displayName: body.displayName ?? "",
        role: body.role === "commissioner" ? "commissioner" : "player",
      }),
    );
    return jsonOk({ user });
  } catch (e) {
    return mapDomainError(e);
  }
}
