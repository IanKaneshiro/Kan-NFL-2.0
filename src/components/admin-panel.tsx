"use client";

import { useCallback, useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  hasPassword: boolean;
};

type AdminGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  winnerTeam: string | null;
  status: string;
};

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<string | null>(null);
  const [syncWeek, setSyncWeek] = useState("1");
  const [games, setGames] = useState<AdminGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadGames = useCallback(async (week: string) => {
    const res = await fetch(`/api/admin/games?week=${week}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load games");
      setGames([]);
      setSelectedGameId("");
      return;
    }
    const next: AdminGame[] = data.games ?? [];
    setGames(next);
    setSelectedGameId((prev) =>
      next.some((g) => g.id === prev) ? prev : (next[0]?.id ?? ""),
    );
  }, []);

  useEffect(() => {
    void loadGames(syncWeek);
  }, [loadGames, syncWeek]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName, role: "player" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setEmail("");
    setDisplayName("");
    setMessage(`Created ${data.user.displayName}`);
    await load();
  }

  async function issueToken(userId: string) {
    setTokenInfo(null);
    const res = await fetch("/api/admin/setup-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Token failed");
      return;
    }
    const full = `${window.location.origin}${data.url}`;
    setTokenInfo(full);
    await navigator.clipboard?.writeText(full).catch(() => undefined);
  }

  async function runSync(all: boolean) {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all ? {} : { week: Number(syncWeek) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sync failed");
      return;
    }
    setMessage(`Sync complete: ${JSON.stringify(data.results?.length ?? 0)} week(s)`);
    await loadGames(syncWeek);
  }

  async function doOverride(winnerTeam: string | null) {
    setError(null);
    setMessage(null);
    if (!selectedGameId) {
      setError("Select a game first");
      return;
    }
    const res = await fetch("/api/admin/override-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: selectedGameId,
        winnerTeam,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Override failed");
      return;
    }
    setMessage(
      winnerTeam
        ? `Override set: ${winnerTeam}`
        : `Override cleared for ${data.gameId}`,
    );
    await loadGames(syncWeek);
  }

  const selectedGame = games.find((g) => g.id === selectedGameId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Commissioner admin</h1>
        <p className="text-sm text-gray-400">
          Manage brothers, setup links, NFL sync, and rare score fixes.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-green-400">{message}</p>}
      {tokenInfo && (
        <p className="break-all rounded-md border border-gray-700 bg-gray-800 p-3 text-xs">
          Setup link (copied if possible): {tokenInfo}
        </p>
      )}

      <section className="rounded-2xl border border-gray-700/80 bg-gray-800/90 p-5">
        <h2 className="mb-3 font-semibold">Players</h2>
        <ul className="mb-4 divide-y divide-gray-700 text-sm">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <div className="font-medium">{u.displayName}</div>
                <div className="text-gray-400">
                  {u.email} · {u.role} ·{" "}
                  {u.hasPassword ? "password set" : "needs setup"}
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-gray-600 px-2 py-1 text-xs hover:bg-gray-700"
                onClick={() => issueToken(u.id)}
              >
                Setup / reset link
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={createUser} className="grid gap-2 sm:grid-cols-3">
          <input
            placeholder="Display name"
            className="rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium hover:bg-green-700"
          >
            Add player
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-700/80 bg-gray-800/90 p-5">
        <h2 className="mb-3 font-semibold">NFL sync (ESPN free API)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={syncWeek}
            onChange={(e) => setSyncWeek(e.target.value)}
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={String(w)}>
                Week {w}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
            onClick={() => runSync(false)}
          >
            Sync week
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500"
            onClick={() => runSync(true)}
          >
            Sync weeks 1–18
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700/80 bg-gray-800/90 p-5">
        <h2 className="mb-3 font-semibold">Override winner</h2>
        <p className="mb-3 text-xs text-gray-400">
          Uses the week selector above. Home / Away set the winner; Clear
          removes the override.
        </p>
        <div className="flex flex-col gap-3">
          <select
            className="rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
            disabled={games.length === 0}
          >
            {games.length === 0 ? (
              <option value="">No games this week</option>
            ) : (
              games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.awayTeam} @ {g.homeTeam}
                  {g.winnerTeam ? ` · winner ${g.winnerTeam}` : ""}
                </option>
              ))
            )}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-amber-700 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950"
              disabled={!selectedGame}
              onClick={() =>
                selectedGame && void doOverride(selectedGame.homeTeam)
              }
            >
              Home{selectedGame ? ` (${selectedGame.homeTeam})` : ""}
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-700 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950"
              disabled={!selectedGame}
              onClick={() =>
                selectedGame && void doOverride(selectedGame.awayTeam)
              }
            >
              Away{selectedGame ? ` (${selectedGame.awayTeam})` : ""}
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-700"
              disabled={!selectedGame}
              onClick={() => void doOverride(null)}
            >
              Clear
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
