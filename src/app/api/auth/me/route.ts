import { eq } from "drizzle-orm";
import { getSession } from "@/auth/session";
import { getDb, schemaTables } from "@/db";
import { jsonOk } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return jsonOk({ user: null });
  }
  const db = getDb();
  const t = schemaTables();
  const rows = await db
    .select()
    .from(t.users)
    .where(eq(t.users.id, session.userId));
  const u = rows[0];
  if (!u) return jsonOk({ user: null });
  return jsonOk({
    user: {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
    },
  });
}
