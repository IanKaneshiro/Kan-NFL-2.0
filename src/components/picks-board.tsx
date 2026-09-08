"use client";

import { useCallback, useEffect, useState } from "react";
import { TeamLogo } from "@/components/team-logo";

type Game = {
  id: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  homeName: string | null;
  awayName: string | null;
  status: string;
  winnerTeam: string | null;
  locked: boolean;
};

type Revealed = {
  gameId: string;
  userId: string;
  displayName: string;
  pickedTeam: string;
  correct: boolean | null;
};

type View = {
  week: number;
  currentWeek: number;
  seasonYear: number;
  staleWarning?: string;
  games: Game[];
  myPicks: Record<string, string>;
  revealedPicks: Revealed[];
};

export function PicksBoard({ initialWeek }: { initialWeek?: number }) {
  const [week, setWeek] = useState(initialWeek ?? 1);
  const [view, setView] = useState<View | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (w: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/picks?week=${w}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load picks");
        return;
      }
      setView(data);
      setWeek(data.week);
      setPicks(data.myPicks ?? {});
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!view) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = Object.entries(picks).map(([gameId, pickedTeam]) => ({
        gameId,
        pickedTeam,
      }));
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: view.week, picks: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setMessage(
        `Picks submitted successfully` +
          (data.lockedGameIds?.length
            ? ` · ${data.lockedGameIds.length} locked skipped`
            : ""),
      );
      await load(view.week);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function changeWeek(direction: "prev" | "next") {
    const next = direction === "prev" ? week - 1 : week + 1;
    if (next < 1 || next > 18) return;
    setWeek(next);
    void load(next);
  }

  const currentWeek = view?.currentWeek ?? week;

  if (loading && !view) {
    return (
      <div className="w-full space-y-6">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg"
          >
            <div className="mb-4 h-7 w-3/4 rounded bg-gray-700" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="h-16 rounded-lg bg-gray-700" />
              <div className="h-16 rounded-lg bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <header className="mb-8 w-full text-center">
        <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
          Week {view?.week ?? week} Picks
          {(view?.week ?? week) === currentWeek ? " (Current Week)" : ""}
        </h1>
        <p className="text-sm text-gray-300 sm:text-base">
          Select the team you think will win each game
        </p>
      </header>

      <div className="mb-8 flex w-full max-w-md flex-col justify-center space-y-3 sm:flex-row sm:space-y-0 sm:space-x-6">
        <button
          type="button"
          onClick={() => changeWeek("prev")}
          disabled={week === 1}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:shadow-none sm:w-auto sm:text-base"
        >
          ← Previous Week
        </button>
        <button
          type="button"
          onClick={() => changeWeek("next")}
          disabled={week === 18}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:shadow-none sm:w-auto sm:text-base"
        >
          Next Week →
        </button>
      </div>

      {view?.staleWarning && (
        <p className="mb-4 w-full rounded-lg border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {view.staleWarning}
        </p>
      )}
      {error && <p className="mb-4 w-full text-sm text-red-400">{error}</p>}
      {message && <p className="mb-4 w-full text-sm text-green-400">{message}</p>}

      {!view?.games.length ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-6xl">🏈</div>
          <p className="text-xl text-gray-300">No games available for this week</p>
          <p className="mt-2 text-gray-400">
            Commissioner can run Sync from Admin, or try another week.
          </p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {view.games.map((g) => {
            const revealed = view.revealedPicks.filter((r) => r.gameId === g.id);
            const awayLabel = g.awayName ?? g.awayTeam;
            const homeLabel = g.homeName ?? g.homeTeam;
            return (
              <div
                key={g.id}
                className={`rounded-xl border bg-gray-800 p-6 shadow-lg ${
                  g.locked
                    ? "border-gray-600 opacity-90"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold text-white sm:text-2xl">
                    {awayLabel} <span className="text-gray-400">@</span> {homeLabel}
                  </h2>
                  <div className="mt-2 flex flex-col sm:mt-0 sm:items-end">
                    <span className="text-sm text-gray-300">
                      {new Date(g.kickoffAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(g.kickoffAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(
                    [
                      { team: g.awayTeam, label: awayLabel, side: "Away" },
                      { team: g.homeTeam, label: homeLabel, side: "Home" },
                    ] as const
                  ).map((opt) => {
                    const selected = picks[g.id] === opt.team;
                    return (
                      <button
                        key={opt.team}
                        type="button"
                        disabled={g.locked}
                        onClick={() =>
                          setPicks((prev) => ({ ...prev, [g.id]: opt.team }))
                        }
                        className={`flex items-center space-x-3 rounded-lg border-2 p-4 text-left ${
                          selected
                            ? "border-blue-500 bg-blue-600 shadow-lg"
                            : g.locked
                              ? "cursor-not-allowed border-gray-600 bg-gray-700"
                              : "border-gray-600 bg-gray-700 hover:border-gray-500"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            selected
                              ? "border-white bg-white"
                              : "border-gray-400"
                          }`}
                        >
                          {selected && (
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                          )}
                        </span>
                        <TeamLogo abbr={opt.team} size="lg" />
                        <div className="flex-1">
                          <span className="text-lg font-semibold text-white">
                            {opt.label}
                          </span>
                          <div className="mt-1 text-xs text-gray-300">
                            {opt.side}
                            {g.winnerTeam === opt.team ? " · winner" : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {g.locked && (
                  <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3">
                    <p className="text-sm text-red-300">
                      This game has already started. Picks are locked.
                    </p>
                  </div>
                )}

                {revealed.length > 0 && (
                  <div className="mt-4 border-t border-gray-700 pt-3 text-sm">
                    <div className="mb-2 text-gray-400">Everyone&apos;s picks</div>
                    <ul className="flex flex-wrap gap-2">
                      {revealed.map((r) => (
                        <li
                          key={`${r.gameId}-${r.userId}`}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            r.correct === true
                              ? "bg-green-900/50 text-green-300"
                              : r.correct === false
                                ? "bg-red-900/40 text-red-300"
                                : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {r.displayName}: {r.pickedTeam}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && view && view.games.length > 0 && (
        <div className="mt-8 w-full max-w-md">
          <button
            type="button"
            onClick={save}
            disabled={saving || !view.games.some((g) => !g.locked)}
            className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "🏈 Submit Picks"}
          </button>
          <p className="mt-3 text-center text-sm text-gray-400">
            {Object.keys(picks).length} of {view.games.length} games selected
          </p>
        </div>
      )}
    </div>
  );
}
