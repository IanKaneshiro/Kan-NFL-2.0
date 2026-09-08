"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarMark } from "@/components/avatar-mark";

type TrendGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
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
      return "bg-green-900/60 text-green-300";
    case "Moderate":
      return "bg-amber-900/60 text-amber-200";
    case "Slight":
      return "bg-blue-900/60 text-blue-200";
    default:
      return "bg-gray-700 text-gray-300";
  }
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
    <div className="flex flex-col items-center">
      <header className="mb-8 w-full text-center">
        <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
          📈 Trends
        </h1>
        <p className="text-sm text-gray-300 sm:text-base">
          Live consensus — tap a side to see who picked it
        </p>
      </header>

      <label className="mb-8 flex items-center gap-2 text-sm text-gray-300">
        Week
        <select
          className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1"
          value={week}
          onChange={(e) => {
            const next = Number(e.target.value);
            setWeek(next);
            void load(next);
          }}
        >
          {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading && !data ? (
        <p className="text-gray-400">Loading…</p>
      ) : !data?.games.length ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-6xl">🏈</div>
          <p className="text-xl text-gray-300">
            No games this week yet.
          </p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {data.popular.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-gray-400 uppercase">
                Popular picks
              </h2>
              <ul className="flex flex-wrap gap-2">
                {data.popular.map((p) => (
                  <li
                    key={`${p.team}-${p.count}`}
                    className="rounded-full bg-gray-700 px-3 py-1 text-sm text-white"
                  >
                    {p.team} · {p.count}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.games.map((g) => (
            <div
              key={g.gameId}
              className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg"
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-white">
                  {g.awayTeam} <span className="text-gray-400">@</span> {g.homeTeam}
                </h2>
                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${consensusClass(g.consensus)}`}
                >
                  {g.consensus} consensus
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SideBar
                  team={g.awayTeam}
                  pct={g.awayPct}
                  count={g.awayCount}
                  onClick={() => void openSide(g, g.awayTeam)}
                />
                <SideBar
                  team={g.homeTeam}
                  pct={g.homePct}
                  count={g.homeCount}
                  onClick={() => void openSide(g, g.homeTeam)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setModal(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pickers-title"
            className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pickers-title" className="text-lg font-bold text-white">
              Who picked {modal.pickedTeam}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {modal.game.awayTeam} @ {modal.game.homeTeam}
            </p>
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
                    className="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2"
                  >
                    <AvatarMark avatarId={p.avatarId} size="sm" />
                    <span className="text-white">{p.displayName}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-5 w-full rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
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

function SideBar({
  team,
  pct,
  count,
  onClick,
}: {
  team: string;
  pct: number;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-600 bg-gray-700 p-4 text-left hover:border-gray-500"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-white">{team}</span>
        <span className="text-sm text-gray-300">
          {pct}% · {count}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
