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
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
            {(view?.week ?? week) === currentWeek ? "Current week" : "Season"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Week {view?.week ?? week}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Pick a winner. You can change it until kickoff.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeWeek("prev")}
            disabled={week === 1}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => changeWeek("next")}
            disabled={week === 18}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </header>

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
                className={`rounded-2xl border bg-gray-800/90 p-3 shadow-lg shadow-black/20 sm:p-5 ${
                  g.locked
                    ? "border-gray-700 opacity-90"
                    : "border-gray-700/80"
                }`}
              >
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-white sm:text-lg">
                    {g.awayTeam} <span className="text-gray-500">@</span> {g.homeTeam}
                  </h2>
                  <span className="shrink-0 text-[11px] text-gray-400">
                    {new Date(g.kickoffAt).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
                        className={`flex min-h-16 flex-col items-center gap-1 rounded-xl border-2 p-2 text-center sm:min-h-0 sm:flex-row sm:gap-3 sm:p-3 sm:text-left ${
                          selected
                            ? "border-emerald-500 bg-emerald-950/50 shadow-lg"
                            : g.locked
                              ? "cursor-not-allowed border-gray-700 bg-gray-800"
                              : "border-gray-600 bg-gray-700/80 hover:border-gray-500"
                        }`}
                      >
                        <TeamLogo abbr={opt.team} size="md" />
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-white sm:text-lg">
                            {opt.team}
                          </span>
                          <div className="hidden text-xs text-gray-300 sm:block">
                            {opt.label}
                            {opt.side ? ` · ${opt.side}` : ""}
                            {g.winnerTeam === opt.team ? " · winner" : ""}
                          </div>
                          <div className="text-[10px] text-gray-400 sm:hidden">
                            {opt.side}
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
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-6 w-full md:bottom-4">
          <button
            type="button"
            onClick={save}
            disabled={saving || !view.games.some((g) => !g.locked)}
            className="w-full rounded-xl bg-emerald-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save picks"}
          </button>
          <p className="mt-2 text-center text-sm text-gray-400">
            {Object.keys(picks).length} of {view.games.length} games selected
          </p>
        </div>
      )}
    </div>
  );
}
