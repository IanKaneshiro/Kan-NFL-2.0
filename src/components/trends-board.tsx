"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarMark } from "@/components/avatar-mark";
import { TeamLogo } from "@/components/team-logo";
import { visibleTeamScore } from "@/lib/game-score";

type TrendGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeCount: number;
  awayCount: number;
  homePct: number;
  awayPct: number;
  consensus: "High" | "Moderate" | "Slight" | "Split";
};

type TrendsPayload = {
  week: number;
  games: TrendGame[];
  popular: { team: string; count: number }[];
};

type Picker = {
  userId: string;
  displayName: string;
  avatarId: string;
};

type ModalState = {
  game: TrendGame;
  pickedTeam: string;
  pickers: Picker[] | null;
  error: string | null;
};

function consensusClass(label: TrendGame["consensus"]): string {
  switch (label) {
    case "High":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
    case "Moderate":
      return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
    case "Slight":
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30";
    default:
      return "bg-gray-700/80 text-gray-300 ring-1 ring-gray-600";
  }
}

function formatMatchupLine(game: TrendGame): string {
  const awayScore = visibleTeamScore(game.status, game.awayScore);
  const homeScore = visibleTeamScore(game.status, game.homeScore);
  const away =
    awayScore != null ? `${game.awayTeam} ${awayScore}` : game.awayTeam;
  const home =
    homeScore != null ? `${game.homeTeam} ${homeScore}` : game.homeTeam;
  return `${away} @ ${home}`;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrendsBoard() {
  const [week, setWeek] = useState(1);
  const [data, setData] = useState<TrendsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const pickerFetchId = useRef(0);

  const load = useCallback(async (w?: number) => {
    setLoading(true);
    setError(null);
    try {
      const q = w != null ? `?week=${w}` : "";
      const res = await fetch(`/api/trends${q}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to load trends");
        return;
      }
      setData(body);
      setWeek(body.week);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const games = useMemo(() => {
    if (!data) return [];
    return [...data.games].sort(
      (a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt),
    );
  }, [data]);

  async function openSide(game: TrendGame, pickedTeam: string) {
    const fetchId = ++pickerFetchId.current;
    setModal({ game, pickedTeam, pickers: null, error: null });
    try {
      const res = await fetch(
        `/api/team-pickers?gameId=${encodeURIComponent(game.gameId)}&pickedTeam=${encodeURIComponent(pickedTeam)}`,
      );
      const body = await res.json();
      if (fetchId !== pickerFetchId.current) return;
      if (!res.ok) {
        setModal((prev) =>
          prev &&
          prev.game.gameId === game.gameId &&
          prev.pickedTeam === pickedTeam
            ? {
                ...prev,
                error: body.error ?? "Failed to load pickers",
                pickers: [],
              }
            : prev,
        );
        return;
      }
      setModal((prev) =>
        prev &&
          prev.game.gameId === game.gameId &&
          prev.pickedTeam === pickedTeam
          ? { ...prev, pickers: body.pickers ?? [], error: null }
          : prev,
      );
    } catch {
      if (fetchId !== pickerFetchId.current) return;
      setModal((prev) =>
        prev &&
        prev.game.gameId === game.gameId &&
        prev.pickedTeam === pickedTeam
          ? { ...prev, error: "Network error", pickers: [] }
          : prev,
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
            This week
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Trends
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Live consensus. Tap a side to see who&apos;s on it.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Week
          <select
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white"
            value={week}
            onChange={(e) => {
              const next = Number(e.target.value);
              setWeek(next);
              void load(next);
            }}
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading && !data ? (
        <p className="text-gray-400">Loading…</p>
      ) : !games.length ? (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-800/40 py-16 text-center">
          <p className="text-lg text-gray-300">No games this week yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {data && data.popular.some((p) => p.count > 0) && (
            <div className="rounded-2xl border border-gray-700/80 bg-gradient-to-br from-gray-800 to-gray-900 p-4">
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Most picked
              </h2>
              <ul className="flex flex-wrap gap-2">
                {data.popular
                  .filter((p) => p.count > 0)
                  .map((p) => (
                    <li
                      key={`${p.team}-${p.count}`}
                      className="flex items-center gap-2 rounded-full bg-gray-900/80 py-1 pr-3 pl-1 ring-1 ring-gray-700"
                    >
                      <TeamLogo abbr={p.team} size="sm" />
                      <span className="text-sm font-medium text-white">
                        {p.team}
                      </span>
                      <span className="text-xs text-gray-400">{p.count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {games.map((g) => {
            const total = g.homeCount + g.awayCount;
            const awayScore = visibleTeamScore(g.status, g.awayScore);
            const homeScore = visibleTeamScore(g.status, g.homeScore);
            return (
              <article
                key={g.gameId}
                className="overflow-hidden rounded-2xl border border-gray-700/80 bg-gray-800/90 shadow-lg shadow-black/20"
              >
                <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
                  <p className="text-xs text-gray-400">
                    {formatKickoff(g.kickoffAt)}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${consensusClass(g.consensus)}`}
                  >
                    {total === 0 ? "No picks" : `${g.consensus} lean`}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void openSide(g, g.awayTeam)}
                    className="flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-gray-700/50"
                  >
                    <TeamLogo abbr={g.awayTeam} size="lg" />
                    <span className="text-sm font-bold text-white">
                      {g.awayTeam}
                      {awayScore != null ? (
                        <span className="text-emerald-300"> {awayScore}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-gray-400">Away</span>
                  </button>
                  <span className="text-xs font-semibold text-gray-500">
                    @
                  </span>
                  <button
                    type="button"
                    onClick={() => void openSide(g, g.homeTeam)}
                    className="flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-gray-700/50"
                  >
                    <TeamLogo abbr={g.homeTeam} size="lg" />
                    <span className="text-sm font-bold text-white">
                      {g.homeTeam}
                      {homeScore != null ? (
                        <span className="text-emerald-300"> {homeScore}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-gray-400">Home</span>
                  </button>
                </div>

                <div className="px-4 pb-4">
                  <div className="mb-1.5 flex justify-between text-xs font-medium text-gray-300">
                    <button
                      type="button"
                      onClick={() => void openSide(g, g.awayTeam)}
                      className="hover:text-white"
                    >
                      {g.awayPct}% · {g.awayCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openSide(g, g.homeTeam)}
                      className="hover:text-white"
                    >
                      {g.homeCount} · {g.homePct}%
                    </button>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-gray-900 ring-1 ring-gray-700">
                    <button
                      type="button"
                      aria-label={`${g.awayTeam} ${g.awayPct} percent`}
                      onClick={() => void openSide(g, g.awayTeam)}
                      className="bg-sky-500/90 hover:bg-sky-400"
                      style={{ width: total === 0 ? "50%" : `${g.awayPct}%` }}
                    />
                    <button
                      type="button"
                      aria-label={`${g.homeTeam} ${g.homePct} percent`}
                      onClick={() => void openSide(g, g.homeTeam)}
                      className="bg-emerald-500/90 hover:bg-emerald-400"
                      style={{ width: total === 0 ? "50%" : `${g.homePct}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4"
          onClick={() => setModal(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pickers-title"
            className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <TeamLogo abbr={modal.pickedTeam} size="lg" />
              <div>
                <h3 id="pickers-title" className="text-lg font-bold text-white">
                  {modal.pickedTeam}
                </h3>
                <p className="text-sm text-gray-400">
                  {formatMatchupLine(modal.game)}
                </p>
              </div>
            </div>
            {modal.error && (
              <p className="mt-3 text-sm text-red-400">{modal.error}</p>
            )}
            {modal.pickers == null && !modal.error ? (
              <p className="mt-4 text-sm text-gray-400">Loading…</p>
            ) : modal.pickers && modal.pickers.length === 0 && !modal.error ? (
              <p className="mt-4 text-sm text-gray-400">
                Nobody picked this side yet.
              </p>
            ) : (
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {modal.pickers?.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center gap-3 rounded-xl bg-gray-800 px-3 py-2"
                  >
                    <AvatarMark avatarId={p.avatarId} size="md" />
                    <span className="font-medium text-white">
                      {p.displayName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white ring-1 ring-gray-700 hover:bg-gray-700"
              onClick={() => setModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
