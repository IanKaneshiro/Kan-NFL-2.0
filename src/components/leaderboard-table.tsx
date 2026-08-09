"use client";

import { useEffect, useState } from "react";

type Row = {
  userId: string;
  displayName: string;
  points: number;
  correct: number;
  finalGames: number;
  rank: number;
};

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <label className="flex items-center gap-2 text-sm">
          Scope
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
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
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Points</th>
                <th className="px-3 py-2">Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-semibold">{r.rank}</td>
                  <td className="px-3 py-2">{r.displayName}</td>
                  <td className="px-3 py-2">{r.points}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {r.correct}-{r.finalGames - r.correct}
                    <span className="text-slate-600">
                      {" "}
                      ({r.finalGames} final)
                    </span>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No standings yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
