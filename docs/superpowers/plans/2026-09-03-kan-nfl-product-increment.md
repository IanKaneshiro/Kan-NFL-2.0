# Kan NFL Product Increment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preset avatars, unique self-serve display names, Trends (reveal-safe), a signed-in home dashboard, PWA install, admin game-picker override, and a keep-alive health ping — on top of the existing 2.0 pick’em.

**Architecture:** Keep Next.js 15 + Drizzle (SQLite/Postgres) + Effect domain + iron-session. New domain modules for avatars, profile updates, trends, and dashboard; no new tables besides `users.avatar_id` and a unique display-name index. Trends never include games where `now < kickoff_at`.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Effect, iron-session, vitest, ESPN sync (existing), GitHub Actions for optional keep-alive.

## Global Constraints

- Workspace: `kan-nfl-2.0` only — do not modify `projects/kan-nfl`
- No Clerk, no file uploads, no new npm dependencies unless a task says otherwise
- Vitest via `npm test` / `npx vitest run <file>`
- Dual schema: always change `src/db/schema.ts`, `src/db/schema.sqlite.ts`, and `scripts/apply-schema.ts` together
- Display names: trim, 2–32 chars, unique case-insensitive
- Default avatar id: `fun-football`
- Reveal: `now >= kickoff_at` (existing `canRevealPicks`)
- Do not weaken existing lock/reveal/scoring tests

## File structure

| File | Responsibility |
|------|----------------|
| `src/domain/avatars.ts` | Preset catalog, `isValidAvatarId`, `resolveAvatarId` |
| `src/domain/users.ts` | Add `updateProfile`; `createUser` sets default avatar |
| `src/domain/trends.ts` | Week trends + team pickers (revealed games only) |
| `src/domain/dashboard.ts` | Signed-in home payload |
| `src/db/schema.ts` / `schema.sqlite.ts` | `users.avatarId` + unique `display_name` |
| `scripts/apply-schema.ts` | DDL + additive migration for existing DBs |
| `src/app/api/auth/profile/route.ts` | PATCH display name / avatar |
| `src/app/api/auth/me/route.ts` | Include `avatarId` |
| `src/app/api/trends/route.ts` | GET `?week=` |
| `src/app/api/team-pickers/route.ts` | GET `?gameId=&pickedTeam=` |
| `src/app/api/dashboard/route.ts` | GET current user dashboard |
| `src/app/api/admin/games/route.ts` | GET `?week=` for override picker |
| `src/components/avatar-mark.tsx` | Render catalog entry |
| `src/components/account-form.tsx` | Name + avatar + password |
| `src/components/trends-board.tsx` | Trends UI |
| `src/components/dashboard-home.tsx` | Dashboard UI |
| `src/app/(app)/trends/page.tsx` | Trends route |
| `src/app/page.tsx` | Marketing if logged out, dashboard if logged in |
| `src/app/manifest.ts` | PWA manifest |
| `src/components/nav.tsx` | Trends link + avatar |
| `src/components/site-chrome.tsx` | Pass `avatarId` |
| `src/components/leaderboard-table.tsx` | Show avatars |
| `src/components/admin-panel.tsx` | Week game dropdown |
| `src/domain/leaderboard.ts` | Pass `avatarId` through |
| `.github/workflows/keep-alive.yml` | Ping `/api/health` |
| `README.md` | Keep-alive + new surfaces |
| `tests/domain/avatars.test.ts` | Catalog |
| `tests/domain/users.profile.integration.test.ts` | `updateProfile` |
| `tests/domain/trends.test.ts` | Reveal + percentages |
| `tests/domain/dashboard.test.ts` | Games left + next lock |

---

### Task 1: Avatar catalog and profile domain

**Files:**
- Create: `src/domain/avatars.ts`
- Create: `tests/domain/avatars.test.ts`
- Create: `tests/domain/users.profile.integration.test.ts`
- Modify: `src/db/schema.ts`, `src/db/schema.sqlite.ts`, `scripts/apply-schema.ts`, `src/domain/users.ts`

**Interfaces:**
- Consumes: `getDb`, `schemaTables`, `ValidationError`, `NotFound`, `newId` (existing)
- Produces:
  - `AVATARS: AvatarDef[]` where `AvatarDef = { id: string; label: string; emoji: string }`
  - `DEFAULT_AVATAR_ID = "fun-football"`
  - `isValidAvatarId(id: string): boolean`
  - `resolveAvatarId(id: string | null | undefined): string`
  - `updateProfile(userId: string, patch: { displayName?: string; avatarId?: string }): Effect<UserRow & { avatarId: string }, ValidationError | NotFound>`
  - `UserRow` includes `avatarId: string`

- [ ] **Step 1: Write catalog unit tests**

Create `tests/domain/avatars.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AVATARS,
  DEFAULT_AVATAR_ID,
  isValidAvatarId,
  resolveAvatarId,
} from "@/domain/avatars";

describe("avatars catalog", () => {
  it("has 32 nfl-* ids and 4 fun-* ids", () => {
    const nfl = AVATARS.filter((a) => a.id.startsWith("nfl-"));
    const fun = AVATARS.filter((a) => a.id.startsWith("fun-"));
    expect(nfl).toHaveLength(32);
    expect(fun).toHaveLength(4);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(36);
  });

  it("accepts catalog ids and rejects unknown", () => {
    expect(isValidAvatarId("nfl-kc")).toBe(true);
    expect(isValidAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
    expect(isValidAvatarId("nfl-xyz")).toBe(false);
    expect(isValidAvatarId("")).toBe(false);
  });

  it("resolveAvatarId falls back to default", () => {
    expect(resolveAvatarId("nfl-buf")).toBe("nfl-buf");
    expect(resolveAvatarId("nope")).toBe(DEFAULT_AVATAR_ID);
    expect(resolveAvatarId(undefined)).toBe(DEFAULT_AVATAR_ID);
  });
});
```

- [ ] **Step 2: Run catalog tests — expect FAIL (module missing)**

Run: `npx vitest run tests/domain/avatars.test.ts`
Expected: FAIL cannot find `@/domain/avatars`

- [ ] **Step 3: Implement `src/domain/avatars.ts`**

```ts
export type AvatarDef = {
  id: string;
  label: string;
  emoji: string;
};

const NFL: Array<[string, string]> = [
  ["ari", "Cardinals"],
  ["atl", "Falcons"],
  ["bal", "Ravens"],
  ["buf", "Bills"],
  ["car", "Panthers"],
  ["chi", "Bears"],
  ["cin", "Bengals"],
  ["cle", "Browns"],
  ["dal", "Cowboys"],
  ["den", "Broncos"],
  ["det", "Lions"],
  ["gb", "Packers"],
  ["hou", "Texans"],
  ["ind", "Colts"],
  ["jax", "Jaguars"],
  ["kc", "Chiefs"],
  ["lac", "Chargers"],
  ["lar", "Rams"],
  ["lv", "Raiders"],
  ["mia", "Dolphins"],
  ["min", "Vikings"],
  ["ne", "Patriots"],
  ["no", "Saints"],
  ["nyg", "Giants"],
  ["nyj", "Jets"],
  ["phi", "Eagles"],
  ["pit", "Steelers"],
  ["sea", "Seahawks"],
  ["sf", "49ers"],
  ["tb", "Buccaneers"],
  ["ten", "Titans"],
  ["was", "Commanders"],
];

const FUN: AvatarDef[] = [
  { id: "fun-football", label: "Football", emoji: "🏈" },
  { id: "fun-trophy", label: "Trophy", emoji: "🏆" },
  { id: "fun-helmet", label: "Helmet", emoji: "🪖" },
  { id: "fun-question", label: "Mystery", emoji: "❓" },
];

export const DEFAULT_AVATAR_ID = "fun-football";

export const AVATARS: AvatarDef[] = [
  ...NFL.map(([abbr, label]) => ({
    id: `nfl-${abbr}`,
    label,
    emoji: abbr.toUpperCase(),
  })),
  ...FUN,
];

const IDS = new Set(AVATARS.map((a) => a.id));

export function isValidAvatarId(id: string): boolean {
  return IDS.has(id);
}

export function resolveAvatarId(id: string | null | undefined): string {
  if (id && IDS.has(id)) return id;
  return DEFAULT_AVATAR_ID;
}

export function getAvatar(id: string | null | undefined): AvatarDef {
  const resolved = resolveAvatarId(id);
  return AVATARS.find((a) => a.id === resolved)!;
}
```

- [ ] **Step 4: Re-run catalog tests — expect PASS**

Run: `npx vitest run tests/domain/avatars.test.ts`
Expected: PASS

- [ ] **Step 5: Write profile integration tests**

Create `tests/domain/users.profile.integration.test.ts` following `tests/domain/picks.integration.test.ts` (temp sqlite `file:./data/test-profile.db`, `apply-schema`, `resetDbCache`).

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { Effect } from "effect";
import { getDb, resetDbCache, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { updateProfile } from "@/domain/users";
import { DEFAULT_AVATAR_ID } from "@/domain/avatars";

const DB = "file:./data/test-profile.db";

describe("updateProfile", () => {
  const a = newId();
  const b = newId();

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.SESSION_SECRET =
      "test-session-secret-at-least-32-characters";
    try {
      unlinkSync("./data/test-profile.db");
    } catch {
      /* ok */
    }
    resetDbCache();
    execSync("npx tsx scripts/apply-schema.ts", {
      env: { ...process.env, DATABASE_URL: DB },
      stdio: "inherit",
    });
    resetDbCache();
    const db = getDb();
    const t = schemaTables();
    const now = new Date();
    await db.insert(t.users).values([
      {
        id: a,
        email: "a@test.com",
        displayName: "Alpha",
        role: "player",
        passwordHash: "x",
        avatarId: DEFAULT_AVATAR_ID,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: b,
        email: "b@test.com",
        displayName: "Beta",
        role: "player",
        passwordHash: "x",
        avatarId: DEFAULT_AVATAR_ID,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("updates name and avatar", async () => {
    const row = await Effect.runPromise(
      updateProfile(a, { displayName: "Al", avatarId: "nfl-kc" }),
    );
    expect(row.displayName).toBe("Al");
    expect(row.avatarId).toBe("nfl-kc");
  });

  it("rejects taken names case-insensitively", async () => {
    const result = await Effect.runPromise(
      Effect.either(updateProfile(a, { displayName: "beta" })),
    );
    expect(result._tag).toBe("Left");
  });

  it("rejects unknown avatar", async () => {
    const result = await Effect.runPromise(
      Effect.either(updateProfile(a, { avatarId: "nfl-xyz" })),
    );
    expect(result._tag).toBe("Left");
  });

  it("allows keeping own name", async () => {
    const row = await Effect.runPromise(
      updateProfile(a, { displayName: "Al" }),
    );
    expect(row.displayName).toBe("Al");
  });
});
```

- [ ] **Step 6: Run profile tests — expect FAIL (no column / no function)**

Run: `npx vitest run tests/domain/users.profile.integration.test.ts`
Expected: FAIL

- [ ] **Step 7: Schema + apply-schema**

Add `avatarId: text("avatar_id").notNull().default("fun-football")` to `users` in both schema files.

Add unique index `users_display_name_uidx` on `displayName` next to the email unique index.

In `scripts/apply-schema.ts`:

1. Add `avatar_id TEXT NOT NULL DEFAULT 'fun-football'` to both `CREATE TABLE users` blocks.
2. Add `CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_uidx ON users(display_name);` after email index in both DDL strings.
3. After applying CREATE DDL, run additive migrations (SQLite: try `ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'fun-football'` and ignore “duplicate column”; Postgres: `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'fun-football';` then `CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_uidx ON users(display_name);`).

SQLite `CREATE TABLE IF NOT EXISTS` will not alter old tables — the ALTER is required for existing local DBs.

- [ ] **Step 8: Implement `updateProfile` in `src/domain/users.ts`**

Extend `UserRow` with `avatarId: string`.

`createUser` insert must set `avatarId: DEFAULT_AVATAR_ID`.

Add:

```ts
export function updateProfile(
  userId: string,
  patch: { displayName?: string; avatarId?: string },
) {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = tables();
      const rows = await db.select().from(t.users).where(eq(t.users.id, userId));
      const user = rows[0];
      if (!user) throw new NotFound({ entity: "user" });

      let displayName = user.displayName;
      if (patch.displayName !== undefined) {
        displayName = patch.displayName.trim();
        if (displayName.length < 2 || displayName.length > 32) {
          throw new ValidationError({
            message: "Display name must be 2–32 characters",
          });
        }
        const others = await db.select().from(t.users);
        const taken = others.some(
          (u) =>
            u.id !== userId &&
            u.displayName.toLowerCase() === displayName.toLowerCase(),
        );
        if (taken) {
          throw new ValidationError({ message: "That display name is taken" });
        }
      }

      let avatarId = user.avatarId ?? DEFAULT_AVATAR_ID;
      if (patch.avatarId !== undefined) {
        if (!isValidAvatarId(patch.avatarId)) {
          throw new ValidationError({ message: "Invalid avatar" });
        }
        avatarId = patch.avatarId;
      }

      await db
        .update(t.users)
        .set({ displayName, avatarId, updatedAt: new Date() })
        .where(eq(t.users.id, userId));

      return {
        id: user.id,
        email: user.email,
        displayName,
        role: user.role as "player" | "commissioner",
        avatarId,
      };
    },
    catch: (e) => {
      if (e instanceof ValidationError || e instanceof NotFound) return e;
      return new ValidationError({ message: String(e) });
    },
  });
}
```

Map `avatarId` in `login`, `completeSetup`, and `listUsers` return objects (`resolveAvatarId(u.avatarId)`).

- [ ] **Step 9: Re-run profile + catalog tests — expect PASS**

Run: `npx vitest run tests/domain/avatars.test.ts tests/domain/users.profile.integration.test.ts`
Expected: PASS

Also run: `npx vitest run tests/domain/picks.integration.test.ts`
If inserts fail on missing `avatarId`, add `avatarId: "fun-football"` (or rely on DB default after schema apply). Prefer setting it explicitly in test inserts.

- [ ] **Step 10: Commit**

```bash
git add src/domain/avatars.ts src/domain/users.ts src/db/schema.ts src/db/schema.sqlite.ts scripts/apply-schema.ts tests/domain/avatars.test.ts tests/domain/users.profile.integration.test.ts
git commit -m "feat: preset avatars and unique display names"
```

---

### Task 2: Profile API, Account UI, avatars on chrome

**Files:**
- Create: `src/app/api/auth/profile/route.ts`
- Create: `src/components/avatar-mark.tsx`
- Modify: `src/app/api/auth/me/route.ts`
- Modify: `src/app/(app)/account/page.tsx` (replace client page with a form that loads `/api/auth/me`)
- Create: `src/components/account-form.tsx`
- Modify: `src/components/nav.tsx`, `src/components/site-chrome.tsx`
- Modify: `src/domain/leaderboard.ts` (`LeaderboardRow.avatarId`)
- Modify: `src/components/leaderboard-table.tsx`

**Interfaces:**
- Consumes: `updateProfile`, `AVATARS`, `getAvatar`, `requireSession` / `getSession`
- Produces: `PATCH /api/auth/profile` body `{ displayName?: string; avatarId?: string }` → `{ user }`; `GET /api/auth/me` includes `avatarId`; `AvatarMark({ avatarId, size?: "sm" | "md" })`

- [ ] **Step 1: Add `src/app/api/auth/profile/route.ts`**

```ts
import { getSession } from "@/auth/session";
import { Unauthorized } from "@/domain/errors";
import { updateProfile } from "@/domain/users";
import { jsonOk, mapDomainError, runEffectToResponse } from "@/lib/api";
import { Effect } from "effect";

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const body = (await req.json()) as {
      displayName?: string;
      avatarId?: string;
    };
    return await runEffectToResponse(
      updateProfile(session.userId, body).pipe(
        Effect.map((user) => ({ user })),
      ),
    );
  } catch (e) {
    return mapDomainError(e);
  }
}
```

If `runEffectToResponse` already wraps data in `jsonOk`, do **not** double-wrap: use `Effect.map` only if the helper expects the program to return the JSON body. Match existing admin routes: they use `Effect.runPromise` + `jsonOk`. Prefer the same pattern as `src/app/api/admin/users/route.ts`.

- [ ] **Step 2: Extend `/api/auth/me` with `avatarId` using `resolveAvatarId`**

- [ ] **Step 3: `AvatarMark`**

```tsx
import { getAvatar } from "@/domain/avatars";

export function AvatarMark({
  avatarId,
  size = "md",
}: {
  avatarId?: string | null;
  size?: "sm" | "md";
}) {
  const a = getAvatar(avatarId);
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <span
      title={a.label}
      className={`inline-flex ${dim} items-center justify-center rounded-full bg-gray-700 font-bold text-white`}
    >
      {a.emoji}
    </span>
  );
}
```

`getAvatar` is a pure import — safe in client components if `avatars.ts` has no Node-only imports.

- [ ] **Step 4: Account form**

Client component: load `GET /api/auth/me`, show display name input, avatar button grid from `AVATARS`, existing password form. PATCH profile; show “That display name is taken” from API.

Replace `src/app/(app)/account/page.tsx` to render `<AccountForm />`.

- [ ] **Step 5: Nav + site-chrome**

`SiteChrome` selects `avatarId` with the user row. `Nav` accepts `avatarId?: string` and renders `<AvatarMark avatarId={avatarId} size="sm" />` next to the name. Add Trends link in desktop + mobile nav: `navLink("/trends", "Trends")` (page lands in Task 4; link can wait until Task 4 if you prefer — **add the link in Task 4**).

- [ ] **Step 6: Leaderboard `avatarId`**

In `getLeaderboard`, include `avatarId: resolveAvatarId(u.avatarId)` on each row. Update `LeaderboardTable` `Row` type and show `<AvatarMark>` beside names and on podium.

- [ ] **Step 7: Run tests**

Run: `npx vitest run`
Expected: PASS (ranking tests still pass; extra field on leaderboard rows is fine if ranking helper is unchanged)

- [ ] **Step 8: Commit**

```bash
git add src/app/api/auth/profile src/app/api/auth/me/route.ts src/components/avatar-mark.tsx src/components/account-form.tsx src/app/(app)/account/page.tsx src/components/nav.tsx src/components/site-chrome.tsx src/domain/leaderboard.ts src/components/leaderboard-table.tsx
git commit -m "feat: account profile editor and avatars in chrome"
```

---

### Task 3: Trends domain

**Files:**
- Create: `src/domain/trends.ts`
- Create: `tests/domain/trends.test.ts`

**Interfaces:**
- Consumes: `canRevealPicks`, `getSeasonYear`, `getDb`, `schemaTables`, `resolveAvatarId`, `NotFound`
- Produces:
  - `consensusLabel(leadingShare: number): "High" | "Moderate" | "Slight" | "Split"`
  - `getWeekTrends(week: number, now?: Date): Effect<TrendsPayload, ValidationError>`
  - `getTeamPickers(gameId: string, pickedTeam: string, now?: Date): Effect<{ pickers: { userId: string; displayName: string; avatarId: string }[] }, NotFound | ValidationError>`
  - `TrendsPayload = { week: number; games: TrendGame[]; popular: { team: string; count: number }[] }`
  - `TrendGame = { gameId: string; homeTeam: string; awayTeam: string; kickoffAt: string; homeCount: number; awayCount: number; homePct: number; awayPct: number; consensus: ReturnType<typeof consensusLabel> }`

- [ ] **Step 1: Write `tests/domain/trends.test.ts`**

Unit-test `consensusLabel`:

- 0.70 → High, 0.60 → Moderate, 0.55 → Slight, 0.50 → Split

Integration-style or pure helper test for filtering: write `buildTrendGames(games, picks, now)` as a **pure exported function** in `trends.ts` so tests do not need a DB:

```ts
it("omits games before kickoff", () => {
  const now = new Date("2026-09-10T18:00:00Z");
  const games = [
    { id: "1", homeTeam: "KC", awayTeam: "BUF", kickoffAt: new Date("2026-09-10T17:00:00Z") },
    { id: "2", homeTeam: "DAL", awayTeam: "NYG", kickoffAt: new Date("2026-09-10T20:00:00Z") },
  ];
  const picks = [
    { gameId: "1", pickedTeam: "KC", userId: "a" },
    { gameId: "1", pickedTeam: "BUF", userId: "b" },
    { gameId: "1", pickedTeam: "KC", userId: "c" },
    { gameId: "2", pickedTeam: "DAL", userId: "a" },
  ];
  const { games: rows, popular } = buildTrendGames(games, picks, now);
  expect(rows).toHaveLength(1);
  expect(rows[0].gameId).toBe("1");
  expect(rows[0].homeCount).toBe(2);
  expect(rows[0].awayCount).toBe(1);
  expect(rows[0].homePct).toBe(67);
  expect(popular[0]).toEqual({ team: "KC", count: 2 });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/domain/trends.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/domain/trends.ts`**

`consensusLabel(share)`: if total picks is 0, Split; else leading share = max(home,away)/total.

Percentages: `Math.round((count / total) * 100)` with home+away totaling 100 when total>0 (if round both to 67/33 that is fine).

`buildTrendGames`: skip game unless `canRevealPicks(kickoffAt, now)`. Count picks matching `homeTeam` / `awayTeam`. Popular: flatten revealed sides, sort by count desc, take 6.

`getWeekTrends`: load season games for week + all users/picks, call `buildTrendGames`, return ISO `kickoffAt`.

`getTeamPickers`: load game; if missing or `!canRevealPicks` throw `NotFound({ entity: "game" })`; return users who picked `pickedTeam` with `resolveAvatarId`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/domain/trends.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/trends.ts tests/domain/trends.test.ts
git commit -m "feat: reveal-safe weekly trends domain"
```

---

### Task 4: Trends API and page

**Files:**
- Create: `src/app/api/trends/route.ts`
- Create: `src/app/api/team-pickers/route.ts`
- Create: `src/components/trends-board.tsx`
- Create: `src/app/(app)/trends/page.tsx`
- Modify: `src/components/nav.tsx` (add Trends in desktop + mobile)

**Interfaces:**
- Consumes: `getWeekTrends`, `getTeamPickers`, session
- Produces: `GET /api/trends?week=N` `{ week, games, popular }`; `GET /api/team-pickers?gameId&pickedTeam` `{ pickers }`

- [ ] **Step 1: Session-gated GET handlers**

Copy leaderboard route auth pattern (`Unauthorized` if no session). Parse `week` as integer 1–18; default omit and let domain use current week **or** require week from the client (client always sends week). Client: default current week from a `data-week` prop on the page from `deriveCurrentWeek` (pass as prop from a tiny server wrapper) or fetch dashboard later. Simplest: trends page is a client component with week select defaulting to `1` then `/api/trends` can default using `deriveCurrentWeek` like leaderboard.

`GET /api/trends`: if no week param, compute current week inside `getWeekTrends` the same way as `getLeaderboard`.

`GET /api/team-pickers`: 404 via `NotFound` when unrevealed.

- [ ] **Step 2: `TrendsBoard` UI**

Week select 1–18. For each game, two bars (home/away %) with consensus pill. Clicking a side fetches team-pickers and opens a modal list with `AvatarMark` + name. Escape closes modal. Empty: “No kicked-off games this week yet.”

- [ ] **Step 3: Page + nav**

`src/app/(app)/trends/page.tsx` renders `<TrendsBoard />`. Nav links to `/trends` on desktop and mobile.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/trends src/app/api/team-pickers src/components/trends-board.tsx src/app/(app)/trends/page.tsx src/components/nav.tsx
git commit -m "feat: trends page and who-picked modal"
```

---

### Task 5: Dashboard

**Files:**
- Create: `src/domain/dashboard.ts`
- Create: `tests/domain/dashboard.test.ts`
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/components/dashboard-home.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getLeaderboard`, `deriveCurrentWeek`, `getSeasonYear`, lock via `now >= kickoffAt`
- Produces: `getDashboard(userId: string, now?: Date): Effect<DashboardPayload, ValidationError | NotFound>`
  - `DashboardPayload = { displayName: string; avatarId: string; week: number; rank: number | null; points: number; gamesLeft: number; nextLockAt: string | null }`

- [ ] **Step 1: Pure helper tests in `tests/domain/dashboard.test.ts`**

Export `summarizeWeek(userId, games, picks, now)`:

- `gamesLeft`: count of games where `now < kickoffAt` and no pick for userId
- `nextLockAt`: min `kickoffAt` among those still open (ISO)

```ts
it("counts unpicked unlocked games and next lock", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const s = summarizeWeek(
    "u1",
    [
      { id: "g1", kickoffAt: new Date("2026-09-10T17:00:00Z") },
      { id: "g2", kickoffAt: new Date("2026-09-11T17:00:00Z") },
      { id: "g3", kickoffAt: new Date("2026-09-10T11:00:00Z") },
    ],
    [{ userId: "u1", gameId: "g1" }],
    now,
  );
  expect(s.gamesLeft).toBe(1);
  expect(s.nextLockAt).toBe("2026-09-11T17:00:00.000Z");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/domain/dashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement domain + `getDashboard`**

Load user (`NotFound` if missing). Load season games, `deriveCurrentWeek`, filter that week, `summarizeWeek`. Call `getLeaderboard()` and find this user for rank/points (null rank if not found).

- [ ] **Step 4: `GET /api/dashboard` session required**

- [ ] **Step 5: `src/app/page.tsx`**

If logged in, render `<DashboardHome />` (client fetch `/api/dashboard`) instead of the marketing hero. Logged out: keep existing marketing. Dashboard cards: avatar+name, “Week N”, rank/points, “N games left”, next lock formatted with `toLocaleString()`, links to `/picks`, `/trends`, `/leaderboard`. If no games: “No schedule yet — ask the commissioner to sync.”

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/domain/dashboard.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domain/dashboard.ts tests/domain/dashboard.test.ts src/app/api/dashboard src/components/dashboard-home.tsx src/app/page.tsx
git commit -m "feat: signed-in home dashboard"
```

---

### Task 6: PWA

**Files:**
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx` metadata

**Interfaces:**
- Produces: `/manifest.webmanifest` with name Kan NFL Pick’em, standalone, start_url `/`, theme `#111827`, background `#111827`, icons using `/file.svg` or existing public SVGs

- [ ] **Step 1: `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kan NFL Pick'em",
    short_name: "Kan NFL",
    description: "Brother pick'em for the NFL regular season",
    start_url: "/",
    display: "standalone",
    background_color: "#111827",
    theme_color: "#111827",
    icons: [
      { src: "/file.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
```

- [ ] **Step 2: Root metadata in `src/app/layout.tsx`**

```ts
export const metadata: Metadata = {
  title: "Kan NFL Pick'em",
  description: "Brother pick'em for the NFL regular season",
  appleWebApp: { capable: true, title: "Kan NFL", statusBarStyle: "black-translucent" },
};
```

No service worker.

- [ ] **Step 3: Commit**

```bash
git add src/app/manifest.ts src/app/layout.tsx
git commit -m "feat: PWA manifest for home-screen install"
```

---

### Task 7: Admin game picker

**Files:**
- Create: `src/app/api/admin/games/route.ts`
- Modify: `src/components/admin-panel.tsx`

**Interfaces:**
- Consumes: `requireLiveCommissioner`, `overrideWinner` (existing POST)
- Produces: `GET /api/admin/games?week=N` `{ games: { id, homeTeam, awayTeam, kickoffAt, winnerTeam, status }[] }` ordered by kickoff

- [ ] **Step 1: GET handler**

Commissioner-only. Query games for `getSeasonYear()` and week. Return JSON list.

- [ ] **Step 2: Admin panel**

Replace raw `overrideGameId` text field: week select (reuse sync week), load games, `<select>` of `awayTeam @ homeTeam`, then Home / Away / TIE buttons that POST `{ gameId, winnerTeam }` using the selected game’s teams. Clear override can POST `winnerTeam: null` if `overrideWinner` already supports null — if it does not, only set home/away/TIE.

Read `overrideWinner` before coding and match its contract exactly.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/games/route.ts src/components/admin-panel.tsx
git commit -m "feat: admin winner override from week game list"
```

---

### Task 8: Keep-alive and README

**Files:**
- Create: `.github/workflows/keep-alive.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: scheduled workflow curling `secrets.KEEPALIVE_URL`; README section “Keep-alive (Render sleep)”

- [ ] **Step 1: Workflow**

```yaml
name: Keep-alive
on:
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping health
        env:
          KEEPALIVE_URL: ${{ secrets.KEEPALIVE_URL }}
        run: |
          if [ -z "$KEEPALIVE_URL" ]; then
            echo "KEEPALIVE_URL secret not set"
            exit 1
          fi
          curl -fsS --max-time 30 "$KEEPALIVE_URL"
```

Use `*/10` because GitHub often will not honor `*/5`. Document UptimeRobot every 5 minutes as the reliable option.

- [ ] **Step 2: README**

Add:

- Logged-in home dashboard, `/trends`, Account name/avatar, PWA install
- Keep-alive: create an UptimeRobot (or cron-job.org) HTTP monitor for `https://<service>.onrender.com/api/health` every 5 minutes. Optional: repo secret `KEEPALIVE_URL` for the GitHub Action. GitHub cron is not minute-accurate.
- Remove “override with internal game id” wording; describe the week game list.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/keep-alive.yml README.md
git commit -m "docs: Render keep-alive ping and product increment notes"
```

---

## Self-review (spec coverage)

| Spec item | Task |
|-----------|------|
| `avatar_id` + unique display name | 1 |
| Catalog 32 + 4 | 1 |
| Account editor | 2 |
| Avatars on nav/leaderboard | 2 |
| Trends reveal-safe + who-picked | 3–4 |
| Dashboard | 5 |
| PWA | 6 |
| Admin game list | 7 |
| Keep-alive | 8 |
| No photo upload / no Clerk | all |
