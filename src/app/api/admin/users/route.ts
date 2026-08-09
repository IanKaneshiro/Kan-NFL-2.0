import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Forbidden, Unauthorized } from "@/domain/errors";
import { createUser, listUsers } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

async function requireCommissioner() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
  if (session.role !== "commissioner") throw new Forbidden({});
  return session;
}

export async function GET() {
  try {
    await requireCommissioner();
    const users = await Effect.runPromise(listUsers());
    return jsonOk({ users });
  } catch (e) {
    return mapDomainError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireCommissioner();
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
