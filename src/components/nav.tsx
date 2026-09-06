"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarMark } from "@/components/avatar-mark";

export function Nav({
  displayName,
  avatarId,
  isCommissioner,
  currentWeek,
  isLoggedIn,
}: {
  displayName?: string;
  avatarId?: string;
  isCommissioner: boolean;
  currentWeek: number;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  const navLink = (href: string, label: string, opts?: { admin?: boolean }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    const admin = opts?.admin;
    return (
      <Link href={href} onClick={closeMenu}>
        <span
          className={`block rounded-md px-3 py-2 text-sm font-medium sm:px-4 ${
            admin
              ? "bg-red-600 text-white hover:bg-red-700"
              : active
                ? "bg-blue-700 text-white"
                : "text-white hover:bg-blue-700"
          }`}
        >
          {label}
        </span>
      </Link>
    );
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    closeMenu();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="relative flex h-16 items-center justify-between gap-4 bg-gray-900 px-4 text-white">
      <div className="flex items-center gap-3">
        <Link href="/" onClick={closeMenu} className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl">🏈</span>
          <span className="hidden text-lg font-semibold sm:inline">
            NFL Pick&apos;em
          </span>
        </Link>
        <span className="hidden rounded-md bg-gray-800 px-2 py-1 text-sm text-gray-400 lg:inline">
          Week {currentWeek}
        </span>
        <nav className="hidden items-center gap-2 md:flex">
          {isLoggedIn && navLink("/picks", "Picks")}
          {isLoggedIn && navLink("/trends", "Trends")}
          {isLoggedIn && navLink("/leaderboard", "Leader Board")}
          {isLoggedIn && navLink("/account", "Account")}
          {isCommissioner && navLink("/admin", "Admin", { admin: true })}
        </nav>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-md p-2 hover:bg-gray-800 md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {isLoggedIn ? (
          <>
            <span className="hidden items-center gap-2 text-gray-300 sm:inline-flex">
              <AvatarMark avatarId={avatarId} size="sm" />
              {displayName}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md px-3 py-2 hover:bg-blue-700"
            >
              Log out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md px-4 py-2 hover:bg-blue-700"
          >
            Sign In
          </Link>
        )}
      </div>

      {menuOpen && (
        <div className="absolute top-16 left-0 z-50 w-full border-t border-gray-700 bg-gray-900 md:hidden">
          <div className="flex flex-col space-y-1 p-4">
            {isLoggedIn && navLink("/picks", "Picks")}
            {isLoggedIn && navLink("/trends", "Trends")}
            {isLoggedIn && navLink("/leaderboard", "Leader Board")}
            {isLoggedIn && navLink("/account", "Account")}
            {isCommissioner && navLink("/admin", "Admin", { admin: true })}
            {!isLoggedIn && navLink("/login", "Sign In")}
          </div>
        </div>
      )}
    </header>
  );
}
