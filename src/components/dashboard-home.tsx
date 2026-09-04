"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AvatarMark } from "@/components/avatar-mark";

type DashboardPayload = {
  displayName: string;
  avatarId: string;
  week: number;
  rank: number | null;
  points: number;
  gamesLeft: number;
  nextLockAt: string | null;
  hasSchedule: boolean;
};

export function DashboardHome() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard");
        const body = (await res.json()) as DashboardPayload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(body.error ?? "Failed to load dashboard");
          return;
        }
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-gray-400">Loading dashboard…</div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-4 py-16 text-center text-red-400">
        {error ?? "Failed to load dashboard"}
      </div>
    );
  }

  const nextLock = data.nextLockAt
    ? new Date(data.nextLockAt).toLocaleString()
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-4">
        <AvatarMark avatarId={data.avatarId} size="md" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {data.displayName}
          </h1>
          <p className="text-lg font-semibold text-green-400">Week {data.week}</p>
        </div>
      </div>

      {!data.hasSchedule ? (
        <p className="mb-8 rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-300">
          No schedule yet — ask the commissioner to sync.
        </p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <p className="text-sm text-gray-400">Rank</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {data.rank == null ? "—" : `#${data.rank}`}
            </p>
            <p className="mt-1 text-gray-400">{data.points} pts</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <p className="text-sm text-gray-400">Games left</p>
            <p className="mt-1 text-3xl font-bold text-white">{data.gamesLeft}</p>
            <p className="mt-1 text-gray-400">unpicked this week</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <p className="text-sm text-gray-400">Next lock</p>
            <p className="mt-1 text-xl font-bold text-white">
              {nextLock ?? "None"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col items-stretch justify-start gap-4 sm:flex-row">
        <Link
          href="/picks"
          className="rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 text-center font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800"
        >
          Picks
        </Link>
        <Link
          href="/trends"
          className="rounded-xl border border-gray-600 bg-gray-700 px-6 py-3 text-center font-semibold text-white shadow-lg hover:bg-gray-600"
        >
          Trends
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-xl border border-gray-600 bg-gray-700 px-6 py-3 text-center font-semibold text-white shadow-lg hover:bg-gray-600"
        >
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
