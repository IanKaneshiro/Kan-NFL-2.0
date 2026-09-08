"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AvatarMark } from "@/components/avatar-mark";
import { BrandMark } from "@/components/brand-mark";

const TABS: Array<{
  href: string;
  label: string;
  icon?: (props: { active: boolean }) => React.ReactNode;
}> = [
  { href: "/picks", label: "Picks", icon: IconWhistle },
  { href: "/trends", label: "Trends", icon: IconChart },
  { href: "/leaderboard", label: "Board", icon: IconTrophy },
  { href: "/account", label: "You" },
];

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

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const desktopLink = (href: string, label: string, admin?: boolean) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          admin
            ? "bg-red-600 text-white"
            : active
              ? "bg-emerald-700 text-white"
              : "text-gray-200 hover:bg-gray-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-3 sm:h-14 sm:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
            <BrandMark size={26} />
            <span className="truncate">Kan NFL</span>
            <span className="rounded-md bg-gray-800 px-1.5 py-0.5 text-[11px] font-medium text-gray-400">
              Wk {currentWeek}
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {isLoggedIn && desktopLink("/picks", "Picks")}
            {isLoggedIn && desktopLink("/trends", "Trends")}
            {isLoggedIn && desktopLink("/leaderboard", "Leaderboard")}
            {isLoggedIn && desktopLink("/account", "Account")}
            {isCommissioner && desktopLink("/admin", "Admin", true)}
            {isLoggedIn && (
              <span className="ml-1 flex items-center gap-2 text-sm text-gray-300">
                <AvatarMark avatarId={avatarId} size="sm" />
                <span className="max-w-[8rem] truncate">{displayName}</span>
              </span>
            )}
            {isLoggedIn ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Log out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
              >
                Sign in
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {isCommissioner && (
              <Link
                href="/admin"
                className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white"
              >
                Admin
              </Link>
            )}
            {!isLoggedIn && (
              <Link
                href="/login"
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
              >
                Sign in
              </Link>
            )}
            {isLoggedIn && (
              <span className="sr-only">{displayName}</span>
            )}
          </div>
        </div>
      </header>

      {isLoggedIn && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-800 bg-gray-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <div className="grid grid-cols-4">
            {TABS.map((tab) => {
              const active = isActive(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                    active ? "text-emerald-400" : "text-gray-400"
                  }`}
                >
                  {tab.href === "/account" ? (
                    <AvatarMark avatarId={avatarId} size="sm" />
                  ) : (
                    Icon && <Icon active={active} />
                  )}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

function IconWhistle({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "text-emerald-400" : ""}
        d="M9 8h6a4 4 0 010 8h-1l-2 3H9a4 4 0 010-8zm0 0V7"
      />
    </svg>
  );
}

function IconChart({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "text-emerald-400" : ""}
        d="M4 19V5m0 14h16M8 17V9m4 8v-5m4 5V7"
      />
    </svg>
  );
}

function IconTrophy({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "text-emerald-400" : ""}
        d="M8 5h8v4a4 4 0 01-4 4 4 4 0 01-4-4V5zm0 0H6a2 2 0 002 3m8-3h2a2 2 0 01-2 3M12 13v3m-3 3h6"
      />
    </svg>
  );
}

