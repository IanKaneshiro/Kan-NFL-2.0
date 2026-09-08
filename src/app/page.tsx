import Link from "next/link";
import { getSession } from "@/auth/session";
import { DashboardHome } from "@/components/dashboard-home";
import { getDb, schemaTables } from "@/db";
import { deriveCurrentWeek, getSeasonYear } from "@/domain/season";
import { eq } from "drizzle-orm";

export default async function Home() {
  const session = await getSession();
  const loggedIn = Boolean(session.isLoggedIn && session.userId);
  if (loggedIn) {
    return <DashboardHome />;
  }

  let currentWeek = 1;
  try {
    const db = getDb();
    const t = schemaTables();
    const games = await db
      .select({ week: t.games.week, status: t.games.status })
      .from(t.games)
      .where(eq(t.games.seasonYear, getSeasonYear()));
    currentWeek = deriveCurrentWeek(games);
  } catch {
    /* keep default week */
  }

  return (
    <div className="flex flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-4xl text-center">
        <div className="mb-6 text-6xl sm:text-7xl lg:text-8xl">🏈</div>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          NFL Pick&apos;em Challenge
        </h1>
        <div className="mb-6 text-lg font-semibold text-green-400 sm:text-xl">
          Week {currentWeek}
        </div>
        <p className="mb-10 text-lg leading-relaxed text-gray-300 sm:text-xl lg:text-2xl">
          Compete with your brothers by predicting the winner of each NFL game
          every week. Climb the leaderboard and claim bragging rights.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/login"
            className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800 sm:w-auto"
          >
            Make Your Picks
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-gray-600 bg-gray-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-gray-600 sm:w-auto"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      <div className="mt-16 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
          <div className="mb-4 text-4xl">🎯</div>
          <h3 className="mb-2 text-xl font-semibold text-white">Weekly Picks</h3>
          <p className="text-gray-300">
            Pick winners for every NFL game each week of the season
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
          <div className="mb-4 text-4xl">🔓</div>
          <h3 className="mb-2 text-xl font-semibold text-white">
            Lock at kickoff
          </h3>
          <p className="text-gray-300">
            Each game locks on its own. Trends show everyone&apos;s picks anytime.
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
          <div className="mb-4 text-4xl">🏆</div>
          <h3 className="mb-2 text-xl font-semibold text-white">Compete & Win</h3>
          <p className="text-gray-300">
            Climb the leaderboard and earn bragging rights all season long
          </p>
        </div>
      </div>
    </div>
  );
}
