import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { getDb, schemaTables } from "@/db";
import { Forbidden, Unauthorized } from "@/domain/errors";
import { sessionOptions, type SessionData } from "@/auth/session-options";

export {
  sessionOptions,
  SESSION_TTL_SEC,
  type SessionData,
} from "@/auth/session-options";

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export async function liveUserRole(
  userId: string,
): Promise<"player" | "commissioner" | null> {
  const db = getDb();
  const t = schemaTables();
  const rows = await db.select().from(t.users).where(eq(t.users.id, userId));
  const role = rows[0]?.role;
  if (role === "player" || role === "commissioner") return role;
  return null;
}

export async function requireLiveCommissioner() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
  const role = await liveUserRole(session.userId);
  if (!role) throw new Unauthorized({});
  if (role !== "commissioner") throw new Forbidden({});
  return {
    userId: session.userId,
    role,
    email: session.email,
  };
}

export function requireSessionEffect() {
  return Effect.tryPromise({
    try: async () => {
      const session = await getSession();
      if (!session.isLoggedIn || !session.userId) {
        throw new Unauthorized({});
      }
      const role = await liveUserRole(session.userId);
      if (!role) throw new Unauthorized({});
      return {
        userId: session.userId,
        role,
        email: session.email,
      };
    },
    catch: (e) => (e instanceof Unauthorized ? e : new Unauthorized({})),
  });
}

export function requireCommissionerEffect() {
  return Effect.gen(function* () {
    const s = yield* requireSessionEffect();
    if (s.role !== "commissioner") {
      return yield* Effect.fail(new Forbidden({}));
    }
    return s;
  });
}
