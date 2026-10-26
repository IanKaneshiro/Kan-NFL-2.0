"use client";

import { useEffect, useState } from "react";
import { AvatarMark } from "@/components/avatar-mark";
import { TeamLogo } from "@/components/team-logo";
import { visibleTeamScore } from "@/lib/game-score";

type BreakdownGame = {
  gameId: string;
  week: number;
  kickoffAt: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeam: string | null;
  pickedTeam: string | null;
  result: "wrong" | "missed" | "live" | "correct";
};

type Breakdown = {
  points: number;
  correct: number;
  wrong: number;
  missed: number;
  burnedBy: { team: string; count: number }[];
  games: BreakdownGame[];
};

export type BreakdownPlayer = {
  userId: string;
  displayName: string;
  avatarId: string;
};

function resultBadge(result: BreakdownGame["result"]): {
  label: string;
  cls: string;
} {
  switch (result) {
    case "correct":
      return {
        label: "✓ +1",
        cls: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      };
    case "wrong":
      return {
        label: "✗ 0",
        cls: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
      };
    case "missed":
      return {
        label: "No pick",
        cls: "bg-gray-700/80 text-gray-300 ring-1 ring-gray-600",
      };
    default:
      return {
        label: "Live",
        cls: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
      };
  }
}

function scoreLine(g: BreakdownGame): string {
  const away = visibleTeamScore(g.status, g.awayScore);
  const home = visibleTeamScore(g.status, g.homeScore);
  return away != null && home != null
    ? `${g.awayTeam} ${away} @ ${g.homeTeam} ${home}`
    : `${g.awayTeam} @ ${g.homeTeam}`;
}

export function PlayerBreakdownSheet({
  player,
  week,
  onClose,
}: {
  player: BreakdownPlayer;
  week: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const q = new URLSearchParams({ userId: player.userId });
        if (week) q.set("week", week);
        const res = await fetch(`/api/player-breakdown?${q}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "Failed to load breakdown");
          return;
        }
        setData(body);
      } catch {
        if (!cancelled) setError("Network error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [player.userId, week]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-title"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AvatarMark avatarId={player.avatarId} size="md" />
          <div>
            <h3 id="breakdown-title" className="text-lg font-bold text-white">
              {player.displayName}
            </h3>
            <p className="text-sm text-gray-400">
              {week ? `Week ${week}` : "Season"}
              {data
                ? ` · ${data.points} pts · ${data.correct}-${data.wrong}${data.missed ? ` · ${data.missed} missed` : ""}`
                : ""}
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {!data && !error ? (
          <p className="mt-4 text-sm text-gray-400">Loading…</p>
        ) : data && data.games.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No games have kicked off yet.
          </p>
        ) : data ? (
          <div className="mt-4 min-h-0 overflow-y-auto">
            {data.burnedBy.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Burned by
                </h4>
                <ul className="flex flex-wrap gap-2">
                  {data.burnedBy.map((b) => (
                    <li
                      key={b.team}
                      className="flex items-center gap-2 rounded-full bg-red-500/10 py-1 pr-3 pl-1 ring-1 ring-red-500/30"
                    >
                      <TeamLogo abbr={b.team} size="sm" />
                      <span className="text-sm font-medium text-white">
                        {b.team}
                      </span>
                      {b.count > 1 && (
                        <span className="text-xs text-red-300">×{b.count}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="space-y-2">
              {data.games.map((g) => {
                const badge = resultBadge(g.result);
                return (
                  <li
                    key={g.gameId}
                    className="flex items-center gap-3 rounded-xl bg-gray-800 px-3 py-2"
                  >
                    {g.pickedTeam ? (
                      <TeamLogo abbr={g.pickedTeam} size="sm" />
                    ) : (
                      <span className="h-6 w-6 shrink-0 rounded-full bg-gray-700" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {g.pickedTeam ? `Picked ${g.pickedTeam}` : "No pick"}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {!week && `Wk ${g.week} · `}
                        {scoreLine(g)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white ring-1 ring-gray-700 hover:bg-gray-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
