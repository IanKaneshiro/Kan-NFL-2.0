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
  weeks: BreakdownWeek[];
  games: BreakdownGame[];
};

type BreakdownWeek = {
  week: number;
  points: number;
  correct: number;
  wrong: number;
  missed: number;
  live: number;
};

export type BreakdownPlayer = {
  userId: string;
  displayName: string;
  avatarId: string;
};

const SECTIONS: {
  result: BreakdownGame["result"];
  title: string;
  hint: string;
  titleCls: string;
}[] = [
  {
    result: "wrong",
    title: "Cost points",
    hint: "Picked the team that lost.",
    titleCls: "text-red-300",
  },
  {
    result: "missed",
    title: "No pick made",
    hint: "Missed picks score 0.",
    titleCls: "text-gray-300",
  },
  {
    result: "live",
    title: "In progress",
    hint: "Counts once the game is final.",
    titleCls: "text-amber-200",
  },
  {
    result: "correct",
    title: "Got it right",
    hint: "+1 point each.",
    titleCls: "text-emerald-300",
  },
];

function TeamSide({
  team,
  score,
  game,
}: {
  team: string;
  score: number | null;
  game: BreakdownGame;
}) {
  const picked = game.pickedTeam === team;
  const won = game.winnerTeam === team;
  const pickRing =
    game.result === "correct"
      ? "ring-2 ring-emerald-400"
      : game.result === "wrong"
        ? "ring-2 ring-red-400"
        : "ring-2 ring-amber-300";
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className={`rounded-full ${picked ? pickRing : ""}`}>
        <TeamLogo abbr={team} size="md" />
      </span>
      <span
        className={`text-sm ${won ? "font-bold text-white" : "text-gray-400"}`}
      >
        {team}
        {score != null ? ` ${score}` : ""}
      </span>
      <span
        className={`text-[10px] font-semibold tracking-wide uppercase ${picked ? "text-gray-200" : "invisible"}`}
      >
        Picked
      </span>
    </div>
  );
}

function GameRow({ game }: { game: BreakdownGame }) {
  return (
    <li className="rounded-xl bg-gray-800 px-3 pt-2 pb-1">
      <div className="flex items-center gap-2">
        <TeamSide
          team={game.awayTeam}
          score={visibleTeamScore(game.status, game.awayScore)}
          game={game}
        />
        <span className="pb-5 text-xs font-semibold text-gray-500">@</span>
        <TeamSide
          team={game.homeTeam}
          score={visibleTeamScore(game.status, game.homeScore)}
          game={game}
        />
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className="flex-1 rounded-xl bg-gray-800 px-2 py-2 text-center">
      <p className={`text-xl font-bold ${cls}`}>{value}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </div>
  );
}

function worstWeek(weeks: BreakdownWeek[]): number | null {
  const done = weeks.filter((w) => w.live === 0);
  if (done.length < 2) return null;
  return done.reduce((worst, w) => (w.points < worst.points ? w : worst)).week;
}

function WeekList({
  weeks,
  onPick,
}: {
  weeks: BreakdownWeek[];
  onPick: (week: number) => void;
}) {
  const worst = worstWeek(weeks);
  return (
    <section>
      <h4 className="text-sm font-semibold text-white">By week</h4>
      <p className="mb-2 text-xs text-gray-400">Tap a week to see its games.</p>
      <ul className="space-y-2">
        {[...weeks].reverse().map((w) => {
          const isWorst = w.week === worst;
          return (
            <li key={w.week}>
              <button
                type="button"
                onClick={() => onPick(w.week)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-700 ${
                  isWorst
                    ? "bg-red-500/10 ring-1 ring-red-500/30"
                    : "bg-gray-800"
                }`}
              >
                <span className="w-16 shrink-0 text-sm font-semibold text-white">
                  Week {w.week}
                </span>
                <span className="flex-1 text-sm text-gray-300">
                  <span className="font-bold text-white">{w.points} pts</span>
                  {" · "}
                  {w.correct}-{w.wrong}
                  {w.missed ? ` · ${w.missed} missed` : ""}
                  {w.live ? ` · ${w.live} live` : ""}
                </span>
                {isWorst && (
                  <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                    Worst
                  </span>
                )}
                <span aria-hidden="true" className="text-gray-500">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
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
  const [scope, setScope] = useState(week);
  const [loaded, setLoaded] = useState<{
    scope: string;
    data: Breakdown | null;
    error: string | null;
  } | null>(null);
  const data = loaded?.scope === scope ? loaded.data : null;
  const error = loaded?.scope === scope ? loaded.error : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const q = new URLSearchParams({ userId: player.userId });
        if (scope) q.set("week", scope);
        const res = await fetch(`/api/player-breakdown?${q}`);
        const body = await res.json();
        if (cancelled) return;
        setLoaded(
          res.ok
            ? { scope, data: body, error: null }
            : {
                scope,
                data: null,
                error: body.error ?? "Failed to load breakdown",
              },
        );
      } catch {
        if (!cancelled) {
          setLoaded({ scope, data: null, error: "Network error" });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [player.userId, scope]);

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
          <h3
            id="breakdown-title"
            className="min-w-0 flex-1 truncate text-lg font-bold text-white"
          >
            {player.displayName}
          </h3>
          <select
            aria-label="Breakdown scope"
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="">Season</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={String(w)}>
                Week {w}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {!data && !error ? (
          <p className="mt-4 text-sm text-gray-400">Loading…</p>
        ) : data && data.games.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No games have kicked off yet.
          </p>
        ) : data ? (
          <div className="mt-4 min-h-0 space-y-5 overflow-y-auto">
            <div className="flex gap-2">
              <Stat label="Points" value={data.points} cls="text-white" />
              <Stat label="Right" value={data.correct} cls="text-emerald-300" />
              <Stat label="Wrong" value={data.wrong} cls="text-red-300" />
              <Stat label="No pick" value={data.missed} cls="text-gray-300" />
            </div>

            {data.burnedBy.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold text-white">Burned by</h4>
                <p className="mb-2 text-xs text-gray-400">
                  Teams {player.displayName} backed that lost.
                </p>
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
                      <span className="text-xs text-red-300">
                        {b.count === 1 ? "1 loss" : `${b.count} losses`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!scope ? (
              <WeekList
                weeks={data.weeks}
                onPick={(w) => setScope(String(w))}
              />
            ) : (
              SECTIONS.map((s) => {
                const games = data.games.filter((g) => g.result === s.result);
                if (!games.length) return null;
                return (
                  <section key={s.result}>
                    <h4 className={`text-sm font-semibold ${s.titleCls}`}>
                      {s.title} ({games.length})
                    </h4>
                    <p className="mb-2 text-xs text-gray-400">{s.hint}</p>
                    <ul className="space-y-2">
                      {games.map((g) => (
                        <GameRow key={g.gameId} game={g} />
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
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
