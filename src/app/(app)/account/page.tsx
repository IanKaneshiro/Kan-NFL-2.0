"use client";

import { useState } from "react";

export default function AccountPage() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setMessage("Password updated");
    setCurrent("");
    setNew("");
  }

  return (
    <div className="max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Current password
          <input
            type="password"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            type="password"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-green-400">{message}</p>}
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500"
        >
          Change password
        </button>
      </form>
    </div>
  );
}
