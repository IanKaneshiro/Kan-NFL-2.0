import { eq } from "drizzle-orm";
import { getSession } from "@/auth/session";
import { Nav } from "@/components/nav";
import { getDb, schemaTables } from "@/db";
import { deriveCurrentWeek, getSeasonYear } from "@/domain/season";

export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const isLoggedIn = Boolean(session.isLoggedIn && session.userId);
  let displayName: string | undefined;
  let avatarId: string | undefined;
  let isCommissioner = false;
  let currentWeek = 1;

  try {
    const db = getDb();
    const t = schemaTables();
    if (session.userId) {
      const rows = await db
        .select()
        .from(t.users)
        .where(eq(t.users.id, session.userId));
      const user = rows[0];
      displayName = user?.displayName;
      avatarId = user?.avatarId;
      isCommissioner = user?.role === "commissioner";
    }
    const games = await db
      .select({ week: t.games.week, status: t.games.status })
      .from(t.games)
      .where(eq(t.games.seasonYear, getSeasonYear()));
    currentWeek = deriveCurrentWeek(games);
  } catch {
    /* nav still renders if DB is down */
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Nav
        displayName={displayName}
        avatarId={avatarId}
        isCommissioner={isCommissioner}
        currentWeek={currentWeek}
        isLoggedIn={isLoggedIn}
      />
      {children}
    </div>
  );
}
