"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS } from "@/domain/avatars";
import { AvatarMark } from "@/components/avatar-mark";

export function AccountForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      const user = data.user as
        | { displayName?: string; avatarId?: string }
        | null
        | undefined;
      if (user) {
        setDisplayName(user.displayName ?? "");
        setAvatarId(user.avatarId ?? "");
      }
    })();
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);
    setProfileLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatarId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? "Failed");
        return;
      }
      setProfileMessage("Profile saved.");
      router.refresh();
    } catch {
      setProfileError("Network error");
    } finally {
      setProfileLoading(false);
    }
  }

  async function onSubmitPassword(e: React.FormEvent) {
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
    setMessage("Password updated.");
    setCurrent("");
    setNew("");
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
        You
      </p>
      <h1 className="mt-1 mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Account</h1>

      <form onSubmit={onSaveProfile} className="mb-8 flex flex-col gap-4 rounded-2xl border border-gray-700/80 bg-gray-800/90 p-5">
        <h2 className="text-lg font-semibold">Profile</h2>
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            type="text"
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={2}
            maxLength={32}
            required
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm">Avatar</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {AVATARS.map((a) => {
              const selected = a.id === avatarId;
              return (
                <button
                  key={a.id}
                  type="button"
                  title={a.label}
                  onClick={() => setAvatarId(a.id)}
                  className={`flex flex-col items-center rounded-xl border p-1.5 ${
                    selected
                      ? "border-green-500 bg-gray-700"
                      : "border-gray-700 bg-gray-800 hover:border-gray-500"
                  }`}
                >
                  <AvatarMark avatarId={a.id} size="md" />
                </button>
              );
            })}
          </div>
        </fieldset>
        {profileError && <p className="text-sm text-red-400">{profileError}</p>}
        {profileMessage && (
          <p className="text-sm text-green-400">{profileMessage}</p>
        )}
        <button
          type="submit"
          disabled={profileLoading}
          className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {profileLoading ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form onSubmit={onSubmitPassword} className="flex max-w-sm flex-col gap-3 rounded-2xl border border-gray-700/80 bg-gray-800/90 p-5">
        <h2 className="text-lg font-semibold">Password</h2>
        <label className="flex flex-col gap-1 text-sm">
          Current password
          <input
            type="password"
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            type="password"
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2"
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
          className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500"
        >
          Change password
        </button>
      </form>

      <button
        type="button"
        className="mt-6 w-full rounded-xl border border-gray-700 py-3 text-sm text-gray-300 hover:bg-gray-800 md:hidden"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
      >
        Log out
      </button>
    </div>
  );
}
