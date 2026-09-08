"use client";

import { useEffect, useState } from "react";
import { AvatarMark } from "@/components/avatar-mark";

type Row = {
  userId: string;
  displayName: string;
  avatarId: string;
  points: number;
  correct: number;
  finalGames: number;
  rank: number;
};

function accuracy(row: Row): number {
  if (!row.finalGames) return 0;
  return Math.round((row.correct / row.finalGames) * 100);
}

function accuracyClass(pct: number): string {
  if (pct >= 70) return "text-green-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function LeaderboardTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [week, setWeek] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(w: string) {
    setLoading(true);
    setError(null);
    try {
      const q = w ? `?week=${w}` : "";
      const res = await fetch(`/api/leaderboard${q}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load");
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  const top = rows.slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
            Standings
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            One point per correct pick.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Scope
          <select
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white"
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              void load(e.target.value);
            }}
          >
            <option value="">Season</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={String(w)}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-6xl">🏈</div>
          <p className="text-xl text-gray-300">No leaderboard data available yet</p>
          <p className="mt-2 text-gray-400">Start making picks to see standings!</p>
        </div>
      ) : (
        <div className="w-full">
          {top.length >= 3 && (
            <div className="mb-8 hidden grid-cols-3 gap-4 sm:grid">
              <PodiumCard place={2} row={top[1]} />
              <PodiumCard place={1} row={top[0]} />
              <PodiumCard place={3} row={top[2]} />
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-700/80 bg-gray-800/90 shadow-lg">
            <div className="bg-gray-800 px-4 py-4 sm:px-6">
              <h2 className="text-sm font-semibold tracking-wider text-gray-400 uppercase">
                Full rankings
              </h2>
            </div>
            <div className="hidden grid-cols-12 gap-4 px-6 py-4 text-sm font-semibold tracking-wider text-gray-300 uppercase sm:grid">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Points</div>
              <div className="col-span-2 text-center">Accuracy</div>
              <div className="col-span-1 text-center">Record</div>
            </div>
            <div className="divide-y divide-gray-700">
              {rows.map((r, index) => {
                const pct = accuracy(r);
                return (
                  <div
                    key={r.userId}
                    className={
                      index === 0
                        ? "border-l-4 border-yellow-400 bg-gradient-to-r from-yellow-900/30 to-yellow-800/30"
                        : index === 1
                          ? "border-l-4 border-gray-400 bg-gradient-to-r from-gray-600/30 to-gray-500/30"
                          : index === 2
                            ? "border-l-4 border-orange-600 bg-gradient-to-r from-orange-900/30 to-orange-800/30"
                            : ""
                    }
                  >
                    <div className="flex items-center justify-between px-4 py-4 sm:hidden">
                      <div className="flex items-center gap-3">
                        <RankBadge index={index} rank={r.rank} />
                        <AvatarMark avatarId={r.avatarId} size="sm" />
                        <span className="text-lg font-medium text-white">
                          {r.displayName}
                        </span>
                      </div>
                      <span className="text-xl font-bold">{r.points}</span>
                    </div>
                    <div className="hidden grid-cols-12 items-center gap-4 px-6 py-4 sm:grid">
                      <div className="col-span-2 text-center">
                        <RankBadge index={index} rank={r.rank} />
                      </div>
                      <div className="col-span-5 flex items-center gap-2 text-lg text-white">
                        <AvatarMark avatarId={r.avatarId} size="sm" />
                        {r.displayName}
                        {index === 0 && <span className="ml-2">👑</span>}
                        {index === 1 && <span className="ml-2">🥈</span>}
                        {index === 2 && <span className="ml-2">🥉</span>}
                      </div>
                      <div className="col-span-2 text-center text-lg font-semibold">
                        {r.points}
                      </div>
                      <div
                        className={`col-span-2 text-center text-sm font-medium ${accuracyClass(pct)}`}
                      >
                        {pct}%
                      </div>
                      <div className="col-span-1 text-center text-sm text-gray-400">
                        {r.correct}-{r.finalGames - r.correct}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RankBadge({ index, rank }: { index: number; rank: number }) {
  const cls =
    index === 0
      ? "bg-yellow-500 text-gray-900"
      : index === 1
        ? "bg-gray-400 text-gray-900"
        : index === 2
          ? "bg-orange-600 text-white"
          : "bg-gray-600 text-white";
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${cls}`}
    >
      {rank}
    </span>
  );
}

function PodiumCard({ place, row }: { place: 1 | 2 | 3; row: Row }) {
  const isFirst = place === 1;
  return (
    <div className={`text-center ${isFirst ? "" : "pt-4 sm:pt-8"}`}>
      <div
        className={
          isFirst
            ? "rounded-xl border-2 border-yellow-400 bg-gradient-to-b from-yellow-400 to-yellow-600 p-3 text-gray-900 shadow-xl sm:p-6"
            : "rounded-xl border-2 border-gray-600 bg-gray-700 p-3 sm:p-6"
        }
      >
        <div className={`mb-2 ${isFirst ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}`}>
          {place === 1 ? "👑" : place === 2 ? "🥈" : "🥉"}
        </div>
        <h3 className={`font-bold ${isFirst ? "text-xl" : "text-lg text-gray-200"}`}>
          {place === 1 ? "Champion" : `${place === 2 ? "2nd" : "3rd"} Place`}
        </h3>
        <div className="mt-2 flex items-center justify-center gap-2">
          <AvatarMark avatarId={row.avatarId} size="md" />
          <p
            className={`truncate font-semibold ${isFirst ? "text-2xl" : "text-xl text-white"}`}
          >
            {row.displayName}
          </p>
        </div>
        <p className={isFirst ? "font-semibold text-gray-800" : "text-gray-300"}>
          {row.points} pts
        </p>
      </div>
    </div>
  );
}
