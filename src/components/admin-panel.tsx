"use client";

import { useCallback, useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  hasPassword: boolean;
};

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<string | null>(null);
  const [syncWeek, setSyncWeek] = useState("1");
  const [overrideGameId, setOverrideGameId] = useState("");
  const [overrideTeam, setOverrideTeam] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
  }

  async function doOverride(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/override-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: overrideGameId,
        winnerTeam: overrideTeam || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Override failed");
      return;
    }
    setMessage(`Override set for ${data.gameId}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Commissioner admin</h1>
        <p className="text-sm text-slate-400">
          Manage brothers, setup links, NFL sync, and rare score fixes.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-green-400">{message}</p>}
      {tokenInfo && (
        <p className="break-all rounded-md border border-slate-700 bg-slate-900 p-3 text-xs">
          Setup link (copied if possible): {tokenInfo}
        </p>
      )}

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 font-semibold">Players</h2>
        <ul className="mb-4 divide-y divide-slate-800 text-sm">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <div className="font-medium">{u.displayName}</div>
                <div className="text-slate-500">
                  {u.email} · {u.role} ·{" "}
                  {u.hasPassword ? "password set" : "needs setup"}
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
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
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500"
          >
            Add player
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
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
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500"
            onClick={() => runSync(true)}
          >
            Sync weeks 1–18
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 font-semibold">Override winner</h2>
        <form onSubmit={doOverride} className="grid gap-2 sm:grid-cols-3">
          <input
            placeholder="Game id"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={overrideGameId}
            onChange={(e) => setOverrideGameId(e.target.value)}
            required
          />
          <input
            placeholder="Winner abbr (e.g. KC)"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={overrideTeam}
            onChange={(e) => setOverrideTeam(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            className="rounded-md border border-amber-700 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950"
          >
            Set override
          </button>
        </form>
      </section>
    </div>
  );
}
