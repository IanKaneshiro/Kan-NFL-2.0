"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav({
  displayName,
  isCommissioner,
}: {
  displayName: string;
  isCommissioner: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const link = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`rounded-md px-3 py-1.5 text-sm ${
          active ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Kan NFL</span>
          <nav className="flex flex-wrap gap-1">
            {link("/picks", "Picks")}
            {link("/leaderboard", "Leaderboard")}
            {link("/account", "Account")}
            {isCommissioner && link("/admin", "Admin")}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>{displayName}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
