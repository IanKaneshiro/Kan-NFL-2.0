"use client";

import { useCallback, useEffect, useState } from "react";

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
        `Saved ${data.saved} pick(s)` +
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

  function selectWeek(w: number) {
    setWeek(w);
    void load(w);
  }

  if (loading && !view) {
    return <p className="text-slate-400">Loading week…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Week {view?.week ?? week} picks</h1>
          <p className="text-sm text-slate-400">
            Season {view?.seasonYear} · current week {view?.currentWeek}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Week
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            value={view?.week ?? week}
            onChange={(e) => selectWeek(Number(e.target.value))}
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>

      {view?.staleWarning && (
        <p className="rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {view.staleWarning}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-green-400">{message}</p>}

      {!view?.games.length && (
        <p className="text-slate-400">
          No games for this week yet. Commissioner can run Sync from Admin.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {view?.games.map((g) => {
          const revealed = view.revealedPicks.filter((r) => r.gameId === g.id);
          return (
            <li
              key={g.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                <span>
                  {new Date(g.kickoffAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span>
                  {g.locked ? "Locked" : "Open"} · {g.status}
                  {g.winnerTeam ? ` · winner ${g.winnerTeam}` : ""}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([g.awayTeam, g.homeTeam] as const).map((team) => {
                  const label =
                    team === g.homeTeam
                      ? g.homeName ?? g.homeTeam
                      : g.awayName ?? g.awayTeam;
                  const selected = picks[g.id] === team;
                  return (
                    <button
                      key={team}
                      type="button"
                      disabled={g.locked}
                      onClick={() =>
                        setPicks((prev) => ({ ...prev, [g.id]: team }))
                      }
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-600/20"
                          : "border-slate-700 hover:border-slate-500"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="font-semibold">{team}</div>
                      <div className="text-xs text-slate-400">{label}</div>
                      <div className="text-xs text-slate-500">
                        {team === g.awayTeam ? "Away" : "Home"}
                      </div>
                    </button>
                  );
                })}
              </div>
              {revealed.length > 0 && (
                <div className="mt-3 border-t border-slate-800 pt-3 text-sm">
                  <div className="mb-1 text-slate-400">Everyone&apos;s picks</div>
                  <ul className="flex flex-wrap gap-2">
                    {revealed.map((r) => (
                      <li
                        key={`${r.gameId}-${r.userId}`}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.correct === true
                            ? "bg-green-900/50 text-green-300"
                            : r.correct === false
                              ? "bg-red-900/40 text-red-300"
                              : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {r.displayName}: {r.pickedTeam}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={save}
        disabled={saving || !view?.games.some((g) => !g.locked)}
        className="sticky bottom-4 self-start rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save picks"}
      </button>
    </div>
  );
}
