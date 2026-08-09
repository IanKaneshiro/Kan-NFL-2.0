# Kan NFL Pick’em 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a private multi-user NFL regular-season pick’em web app (login, weekly picks with per-game locks and reveal, free-API scores, leaderboard) on Render + Postgres with Effect domain logic.

**Architecture:** Next.js 15 App Router greenfield modeled on `ians-mcp`: Drizzle dual dialect (Postgres prod / SQLite local), iron-session multi-user auth, Effect programs for domain (picks, scoring, sync), server-only ESPN public scoreboard adapter, thin route handlers mapping Effect errors to HTTP.

**Tech Stack:** Next.js 15.5.x, React 19, TypeScript 5, Tailwind 4, Drizzle ORM, `@libsql/client` + `postgres`, iron-session, bcryptjs, ulid, zod, effect, vitest, Render.

**Spec:** `docs/superpowers/specs/2026-08-08-kan-nfl-pickem-design.md`

## Global Constraints

- Regular season **weeks 1–18 only**; no playoffs/AI/public signup
- Scoring: **derived** (correct pick = 1, wrong/miss/no winner = 0); no points ledger table
- Picks **lock per game at kickoff** (`now >= kickoff_at`)
- Others’ picks **hidden until that game’s kickoff**; server enforces
- Auth: allowlist + one-time setup token → password; self-service login/logout; **no third-party auth**; **no email provider required**
- Free NFL data: **ESPN public site API** (no API key); fixture tests so provider is swappable
- Session cookie TTL **90 days** (`SESSION_TTL_SEC = 60 * 60 * 24 * 90`)
- Cookie name: `kan_nfl_session`
- `SESSION_SECRET` must be ≥ 32 characters
- Leaderboard sort: points desc, display_name asc; **competition ranks** (1, 2, 2, 4…)
- Follow dual-DB patterns from `/home/iankaneshiro/projects-2026/ians-mcp` (`src/db/dialect.ts`, `getDb`, `db:apply`)
- Domain logic in Effect; pure scoring/lock helpers unit-tested without DB when possible
- YAGNI: no MCP, no confidence points, no spreads
- Every task ends with tests green + commit

---

## File structure (target)

```text
kan-nfl-2.0/
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  eslint.config.mjs
  vitest.config.ts
  drizzle.config.ts
  render.yaml
  .env.example
  README.md
  scripts/
    apply-schema.ts
    hash-password.ts
    seed.ts
  drizzle/                    # postgres SQL migrations (generated + hand apply)
  drizzle/sqlite/             # sqlite-friendly apply scripts if dual like ians-mcp
  data/                       # local.db (gitignored)
  src/
    middleware.ts
    app/
      layout.tsx
      globals.css
      page.tsx                 # redirect → /picks or /login
      login/page.tsx
      setup/page.tsx
      (app)/
        layout.tsx            # nav shell
        picks/page.tsx
        leaderboard/page.tsx
        account/page.tsx      # change password
        admin/page.tsx
      api/
        health/route.ts
        auth/login/route.ts
        auth/logout/route.ts
        auth/me/route.ts
        auth/setup/route.ts
        auth/change-password/route.ts
        picks/route.ts        # GET week view, POST save
        leaderboard/route.ts
        admin/users/route.ts
        admin/setup-token/route.ts
        admin/sync/route.ts
        admin/override-winner/route.ts
    auth/
      session.ts
      password.ts
      setup-token.ts
    db/
      dialect.ts
      index.ts
      schema.ts               # postgres drizzle schema
      schema.sqlite.ts
      tables.ts               # dialect-agnostic table accessors if needed
    domain/
      errors.ts
      ids.ts
      season.ts
      lock.ts
      reveal.ts
      scoring.ts
      ranking.ts
      users.ts
      picks.ts
      leaderboard.ts
      sync.ts
      effect-runtime.ts       # runPromise helpers if needed
    nfl/
      types.ts
      espn-provider.ts
      map-espn.ts
      fixtures/scoreboard-week1.json
    lib/
      api.ts                  # json helpers, mapDomainError
      env.ts
    components/
      nav.tsx
      login-form.tsx
      setup-form.tsx
      picks-board.tsx
      leaderboard-table.tsx
      admin-panel.tsx
  tests/
    domain/
      lock.test.ts
      reveal.test.ts
      scoring.test.ts
      ranking.test.ts
      season.test.ts
    nfl/
      map-espn.test.ts
    auth/
      password.test.ts
      setup-token.test.ts
    domain/
      picks.integration.test.ts   # after DB exists
      leaderboard.integration.test.ts
      sync.integration.test.ts
    api/
      health.test.ts              # optional light
```

---

### Task 1: Scaffold Next app + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/api/health/route.ts`, `src/lib/env.ts`
- Test: `tests/smoke/health-export.test.ts` (or hit route logic)

**Interfaces:**
- Produces: runnable `npm run dev`, `npm test`, path alias `@/*` → `src/*`

- [ ] **Step 1: Scaffold**

From repo root (`kan-nfl-2.0`), create Next 15 app with TypeScript, Tailwind, App Router, eslint. Prefer:

```bash
npx create-next-app@15.5.22 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm
```

If directory is non-empty (docs already present), scaffold into a temp dir and move files, or manually create `package.json` matching versions below — **do not delete** `docs/`.

- [ ] **Step 2: Align dependencies**

Ensure `package.json` includes (versions approximate to ians-mcp / current):

```json
{
  "name": "kan-nfl-2.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:apply": "tsx scripts/apply-schema.ts",
    "db:reset-local": "rm -f data/local.db data/local.db-* && npm run db:apply",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "@libsql/client": "^0.17.4",
    "bcryptjs": "^3.0.3",
    "dotenv": "^17.4.2",
    "drizzle-orm": "^0.45.2",
    "effect": "^3.16.0",
    "iron-session": "^8.0.4",
    "next": "15.5.22",
    "postgres": "^3.4.9",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "ulid": "^3.0.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "drizzle-kit": "^0.31.10",
    "eslint": "^9",
    "eslint-config-next": "15.5.22",
    "tailwindcss": "^4",
    "tsx": "^4.23.1",
    "typescript": "^5",
    "vitest": "^3.2.7"
  }
}
```

Pin `effect` to a current stable 3.x available on npm at install time if `^3.16.0` resolves differently.

- [ ] **Step 3: Vitest config**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 4: Health route + home redirect stub**

`src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "kan-nfl-2.0" });
}
```

`src/app/page.tsx` temporarily:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

- [ ] **Step 5: `.env.example` and `.gitignore`**

`.env.example`:

```bash
DATABASE_URL=file:./data/local.db
SESSION_SECRET=replace-with-openssl-rand-hex-32-minimum-length-secret
SEASON_YEAR=2026
# optional throttle seconds between auto syncs
NFL_SYNC_MIN_INTERVAL_SEC=900
```

Gitignore: `node_modules`, `.next`, `data/`, `.env`, `*.db`.

- [ ] **Step 6: Install and verify**

```bash
npm install
npm test
npm run build
```

Expected: build succeeds; tests may be empty (exit 0).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with vitest and health route"
```

---

### Task 2: Domain pure rules (lock, reveal, scoring, ranking, season)

**Files:**
- Create: `src/domain/lock.ts`, `src/domain/reveal.ts`, `src/domain/scoring.ts`, `src/domain/ranking.ts`, `src/domain/season.ts`, `src/domain/errors.ts`, `src/domain/ids.ts`
- Test: `tests/domain/lock.test.ts`, `reveal.test.ts`, `scoring.test.ts`, `ranking.test.ts`, `season.test.ts`

**Interfaces:**
- Produces:
  - `isGameLocked(kickoffAt: Date, now: Date): boolean`
  - `canRevealPicks(kickoffAt: Date, now: Date): boolean`
  - `scorePick(args: { pickedTeam: string | null; winnerTeam: string | null; status: "scheduled" | "in_progress" | "final" }): 0 | 1 | null`  
    (`null` = not yet scorable; `0`/`1` when final with winner or final without credit)
  - `aggregateUserPoints(finalGames, picksByGameId): number`
  - `competitionRanks(rows: { userId: string; points: number; displayName: string }[]): { userId; points; displayName; rank }[]`
  - `deriveCurrentWeek(games: { week: number; status: string }[], maxWeek = 18): number`
  - `newId(): string` via ulid
  - Error tags in `errors.ts` as string constants / Effect Data.TaggedError classes

- [ ] **Step 1: Write failing tests for lock/reveal**

```ts
// tests/domain/lock.test.ts
import { describe, expect, it } from "vitest";
import { isGameLocked } from "@/domain/lock";

describe("isGameLocked", () => {
  it("is false before kickoff", () => {
    const kickoff = new Date("2026-09-13T17:00:00.000Z");
    const now = new Date("2026-09-13T16:59:59.000Z");
    expect(isGameLocked(kickoff, now)).toBe(false);
  });

  it("is true at kickoff", () => {
    const kickoff = new Date("2026-09-13T17:00:00.000Z");
    expect(isGameLocked(kickoff, kickoff)).toBe(true);
  });
});
```

```ts
// tests/domain/reveal.test.ts
import { describe, expect, it } from "vitest";
import { canRevealPicks } from "@/domain/reveal";

describe("canRevealPicks", () => {
  it("hides before kickoff and reveals at/after", () => {
    const kickoff = new Date("2026-09-13T17:00:00.000Z");
    expect(canRevealPicks(kickoff, new Date("2026-09-13T16:00:00.000Z"))).toBe(false);
    expect(canRevealPicks(kickoff, kickoff)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/domain/lock.test.ts tests/domain/reveal.test.ts
```

- [ ] **Step 3: Implement lock + reveal**

```ts
// src/domain/lock.ts
export function isGameLocked(kickoffAt: Date, now: Date): boolean {
  return now.getTime() >= kickoffAt.getTime();
}
```

```ts
// src/domain/reveal.ts
export function canRevealPicks(kickoffAt: Date, now: Date): boolean {
  return now.getTime() >= kickoffAt.getTime();
}
```

- [ ] **Step 4: Scoring + ranking tests**

```ts
// tests/domain/scoring.test.ts
import { describe, expect, it } from "vitest";
import { aggregateUserPoints, scorePick } from "@/domain/scoring";

describe("scorePick", () => {
  it("returns null when game not final", () => {
    expect(
      scorePick({ pickedTeam: "KC", winnerTeam: null, status: "scheduled" }),
    ).toBeNull();
  });

  it("awards 1 for correct final pick", () => {
    expect(
      scorePick({ pickedTeam: "KC", winnerTeam: "KC", status: "final" }),
    ).toBe(1);
  });

  it("awards 0 for wrong or missing pick when final with winner", () => {
    expect(
      scorePick({ pickedTeam: "BUF", winnerTeam: "KC", status: "final" }),
    ).toBe(0);
    expect(
      scorePick({ pickedTeam: null, winnerTeam: "KC", status: "final" }),
    ).toBe(0);
  });

  it("awards 0 when final but no winner (tie/void)", () => {
    expect(
      scorePick({ pickedTeam: "KC", winnerTeam: null, status: "final" }),
    ).toBe(0);
  });
});

describe("aggregateUserPoints", () => {
  it("sums only final games", () => {
    const games = [
      { id: "g1", status: "final" as const, winnerTeam: "KC" },
      { id: "g2", status: "final" as const, winnerTeam: "BUF" },
      { id: "g3", status: "scheduled" as const, winnerTeam: null },
    ];
    const picks = new Map([
      ["g1", "KC"],
      ["g2", "KC"],
    ]);
    expect(aggregateUserPoints(games, picks)).toBe(1);
  });
});
```

```ts
// tests/domain/ranking.test.ts
import { describe, expect, it } from "vitest";
import { competitionRanks } from "@/domain/ranking";

describe("competitionRanks", () => {
  it("sorts by points then name and uses competition ranks", () => {
    const ranked = competitionRanks([
      { userId: "1", points: 10, displayName: "Zed" },
      { userId: "2", points: 12, displayName: "Amy" },
      { userId: "3", points: 10, displayName: "Bob" },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["2", "3", "1"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2]);
  });
});
```

```ts
// tests/domain/season.test.ts
import { describe, expect, it } from "vitest";
import { deriveCurrentWeek } from "@/domain/season";

describe("deriveCurrentWeek", () => {
  it("returns 1 when no games", () => {
    expect(deriveCurrentWeek([])).toBe(1);
  });

  it("returns first week with a non-final game", () => {
    expect(
      deriveCurrentWeek([
        { week: 1, status: "final" },
        { week: 2, status: "in_progress" },
        { week: 3, status: "scheduled" },
      ]),
    ).toBe(2);
  });

  it("returns last week when all final", () => {
    expect(
      deriveCurrentWeek([
        { week: 1, status: "final" },
        { week: 18, status: "final" },
      ]),
    ).toBe(18);
  });
});
```

- [ ] **Step 5: Implement scoring, ranking, season, errors, ids**

```ts
// src/domain/scoring.ts
export type GameStatus = "scheduled" | "in_progress" | "final";

export function scorePick(args: {
  pickedTeam: string | null;
  winnerTeam: string | null;
  status: GameStatus;
}): 0 | 1 | null {
  if (args.status !== "final") return null;
  if (!args.winnerTeam) return 0;
  if (!args.pickedTeam) return 0;
  return args.pickedTeam === args.winnerTeam ? 1 : 0;
}

export function aggregateUserPoints(
  games: { id: string; status: GameStatus; winnerTeam: string | null }[],
  picksByGameId: Map<string, string>,
): number {
  let total = 0;
  for (const g of games) {
    const s = scorePick({
      pickedTeam: picksByGameId.get(g.id) ?? null,
      winnerTeam: g.winnerTeam,
      status: g.status,
    });
    if (s !== null) total += s;
  }
  return total;
}
```

```ts
// src/domain/ranking.ts
export function competitionRanks(
  rows: { userId: string; points: number; displayName: string }[],
): { userId: string; points: number; displayName: string; rank: number }[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.displayName.localeCompare(b.displayName);
  });
  let lastPoints: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    if (lastPoints === null || row.points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = row.points;
    }
    return { ...row, rank: lastRank };
  });
}
```

```ts
// src/domain/season.ts
export function deriveCurrentWeek(
  games: { week: number; status: string }[],
  maxWeek = 18,
): number {
  if (games.length === 0) return 1;
  const byWeek = new Map<number, string[]>();
  for (const g of games) {
    const list = byWeek.get(g.week) ?? [];
    list.push(g.status);
    byWeek.set(g.week, list);
  }
  for (let w = 1; w <= maxWeek; w++) {
    const statuses = byWeek.get(w);
    if (!statuses) continue;
    if (statuses.some((s) => s !== "final")) return w;
  }
  const weeks = [...byWeek.keys()];
  return Math.min(maxWeek, Math.max(...weeks));
}

export function getSeasonYear(): number {
  const y = Number(process.env.SEASON_YEAR);
  return Number.isFinite(y) && y >= 2000 ? y : new Date().getUTCFullYear();
}
```

```ts
// src/domain/errors.ts
import { Data } from "effect";

export class Unauthorized extends Data.TaggedError("Unauthorized")<{}> {}
export class Forbidden extends Data.TaggedError("Forbidden")<{}> {}
export class InvalidCredentials extends Data.TaggedError("InvalidCredentials")<{}> {}
export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
}> {}
export class NotFound extends Data.TaggedError("NotFound")<{ entity: string }> {}
export class GameLocked extends Data.TaggedError("GameLocked")<{
  gameId: string;
}> {}
export class NflApiError extends Data.TaggedError("NflApiError")<{
  message: string;
}> {}
export class SetupTokenInvalid extends Data.TaggedError("SetupTokenInvalid")<{}> {}
```

```ts
// src/domain/ids.ts
import { ulid } from "ulid";
export function newId(): string {
  return ulid();
}
```

- [ ] **Step 6: Run all domain unit tests**

```bash
npm test -- tests/domain
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domain tests/domain
git commit -m "feat: pure domain rules for lock, reveal, scoring, ranking"
```

---

### Task 3: Database schema + dual dialect + apply script

**Files:**
- Create: `src/db/dialect.ts`, `src/db/schema.ts`, `src/db/schema.sqlite.ts`, `src/db/index.ts`, `src/db/tables.ts`, `drizzle.config.ts`, `scripts/apply-schema.ts`, `drizzle/0000_init.sql` (and sqlite variant if needed)
- Test: `tests/db/dialect.test.ts`

**Interfaces:**
- Produces: `getDb()`, `pingDb()`, `isSqliteUrl()`, tables: `users`, `games`, `picks`, `sync_runs`
- Consumes: `DATABASE_URL`

- [ ] **Step 1: Copy dialect helpers from ians-mcp**

Implement `src/db/dialect.ts` equivalent to ians-mcp (`isSqliteUrl`, `sqliteFilePath`).

Write `tests/db/dialect.test.ts` asserting `file:./data/local.db` is sqlite and `postgresql://…` is not.

- [ ] **Step 2: Define Postgres schema**

`src/db/schema.ts` (Drizzle pg-core):

```ts
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().$type<"player" | "commissioner">(),
  setupTokenHash: text("setup_token_hash"),
  setupTokenExpiresAt: timestamp("setup_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_uidx").on(t.email)]);

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  externalId: text("external_id").notNull(),
  seasonYear: integer("season_year").notNull(),
  week: integer("week").notNull(),
  kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeName: text("home_name"),
  awayName: text("away_name"),
  status: text("status").notNull().$type<"scheduled" | "in_progress" | "final">(),
  winnerTeam: text("winner_team"),
  winnerOverride: boolean("winner_override").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("games_external_id_uidx").on(t.externalId)]);

export const picks = pgTable("picks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  pickedTeam: text("picked_team").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("picks_user_game_uidx").on(t.userId, t.gameId)]);

export const syncRuns = pgTable("sync_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  message: text("message"),
});
```

Mirror with sqlite-core in `schema.sqlite.ts` (integer timestamps or text ISO — match ians-mcp style if present; prefer timestamp modes that libsql accepts).

- [ ] **Step 3: `getDb` / `pingDb`**

Mirror `ians-mcp/src/db/index.ts` patterns (`postgres` + libsql, global cache).

- [ ] **Step 4: `apply-schema.ts`**

Idempotent SQL apply for local SQLite and Postgres (can start with raw SQL strings for the four tables if drizzle dual-generate is painful — follow ians-mcp `scripts/apply-schema.ts` approach).

Minimum: running `DATABASE_URL=file:./data/local.db npm run db:apply` creates tables.

- [ ] **Step 5: Verify apply + dialect tests**

```bash
npm test -- tests/db
DATABASE_URL=file:./data/local.db npm run db:apply
```

- [ ] **Step 6: Commit**

```bash
git add src/db scripts drizzle* drizzle.config.ts
git commit -m "feat: drizzle schema and dual-dialect database setup"
```

---

### Task 4: Password hashing + setup tokens + session

**Files:**
- Create: `src/auth/password.ts`, `src/auth/setup-token.ts`, `src/auth/session.ts`, `scripts/hash-password.ts`
- Test: `tests/auth/password.test.ts`, `tests/auth/setup-token.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`
  - `createSetupToken(): { rawToken: string; tokenHash: string; expiresAt: Date }` (TTL 7 days)
  - `hashSetupToken(raw: string): string` (sha256 hex)
  - `getSession()` / `requireSession()` / `requireCommissioner()`
  - Session data: `{ isLoggedIn: boolean; userId?: string; role?: "player" | "commissioner"; email?: string }`
  - TTL 90 days; cookie `kan_nfl_session`

- [ ] **Step 1: Password tests**

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/auth/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement bcrypt wrappers** (`bcryptjs`, cost 10)

- [ ] **Step 3: Setup token tests**

```ts
import { createSetupToken, hashSetupToken } from "@/auth/setup-token";
// raw token length >= 32; hash is deterministic sha256; expires ~7d ahead
```

- [ ] **Step 4: Session module**

```ts
// src/auth/session.ts — iron-session, cookieName kan_nfl_session, ttl 90d
export type SessionData = {
  isLoggedIn: boolean;
  userId?: string;
  role?: "player" | "commissioner";
  email?: string;
};
```

`requireSession` throws / returns Effect fail `Unauthorized` if not logged in.  
`requireCommissioner` fails `Forbidden` if role !== `commissioner`.

- [ ] **Step 5: Run tests + commit**

```bash
npm test -- tests/auth
git add src/auth scripts/hash-password.ts tests/auth
git commit -m "feat: password hashing, setup tokens, iron-session"
```

---

### Task 5: User domain + auth API routes + login/setup UI

**Files:**
- Create: `src/domain/users.ts`, `src/lib/api.ts`,  
  `src/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`, `setup/route.ts`, `change-password/route.ts`,  
  `src/app/login/page.tsx`, `src/components/login-form.tsx`, `src/app/setup/page.tsx`, `src/components/setup-form.tsx`,  
  `src/middleware.ts` (protect `/picks`, `/leaderboard`, `/admin`, `/account`)
- Test: `tests/domain/users.integration.test.ts` (login/setup with SQLite)

**Interfaces:**
- Produces Effect programs:
  - `login(email, password): Effect<SessionUser, InvalidCredentials | …>`
  - `completeSetup(rawToken, password): Effect<SessionUser, SetupTokenInvalid | ValidationError>`
  - `changePassword(userId, current, next): Effect<void, …>`
  - `createUser({ email, displayName, role }): Effect<User, ValidationError>`
  - `issueSetupToken(userId): Effect<{ rawToken: string; setupPath: string }, …>`
- API:
  - `POST /api/auth/login` `{ email, password }` → 200 + set cookie
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `POST /api/auth/setup` `{ token, password }`
  - `POST /api/auth/change-password` `{ currentPassword, newPassword }`

- [ ] **Step 1: `mapDomainError` in `src/lib/api.ts`**

Map tagged errors to status: InvalidCredentials 401, Unauthorized 401, Forbidden 403, ValidationError 400, SetupTokenInvalid 400, GameLocked 409, NotFound 404, NflApiError 502.

- [ ] **Step 2: Integration test — setup then login**

Use test DB file `file:./data/test.db`, apply schema in `beforeAll`, insert user with setup token, call domain functions (not full HTTP if slower — domain-level is enough).

- [ ] **Step 3: Implement `users.ts` with Effect + Drizzle**

Password min length 8. Email stored lowercased. Setup token single-use: clear hash after success.

- [ ] **Step 4: Wire routes + minimal UI forms**

Login form posts to API; on success `router.push("/picks")`.  
Setup page reads `?token=` query.

- [ ] **Step 5: Middleware**

Allow public: `/login`, `/setup`, `/api/auth/login`, `/api/auth/setup`, `/api/health`.  
Redirect others to `/login` if no session cookie (iron-session encrypt means middleware may only check cookie presence; full validation in route `requireSession`).

- [ ] **Step 6: Tests + commit**

```bash
npm test
git commit -m "feat: multi-user auth setup login logout and change password"
```

---

### Task 6: ESPN provider (free API) + mapper

**Files:**
- Create: `src/nfl/types.ts`, `src/nfl/map-espn.ts`, `src/nfl/espn-provider.ts`, `src/nfl/fixtures/scoreboard-sample.json`
- Test: `tests/nfl/map-espn.test.ts`

**Interfaces:**
- Produces:
  - `type NormalizedGame = { externalId; seasonYear; week; kickoffAt: Date; homeTeam; awayTeam; homeName?; awayName?; status; winnerTeam: string | null }`
  - `mapEspnScoreboard(json: unknown, seasonYear: number, week: number): NormalizedGame[]`
  - `fetchEspnWeek(seasonYear: number, week: number): Effect<NormalizedGame[], NflApiError>`
- HTTP (server-only):  
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={week}&dates={seasonYear}`  
  (`seasontype=2` = regular season). If ESPN requires date tuning, document the working query in README after smoke fetch.

- [ ] **Step 1: Capture fixture**

Save a redacted real or minimal synthetic ESPN-shaped JSON under `src/nfl/fixtures/scoreboard-sample.json` with at least 2 events (scheduled + final with scores).

- [ ] **Step 2: Mapper tests**

Assert team abbreviations, kickoff ISO parse, status mapping:

| ESPN state | our status |
|------------|------------|
| pre | scheduled |
| in | in_progress |
| post | final |

Winner: team with higher score when post; null if tie or missing.

- [ ] **Step 3: Implement mapper + fetch with `Effect.tryPromise`**

- [ ] **Step 4: Tests + commit**

```bash
npm test -- tests/nfl
git commit -m "feat: ESPN scoreboard provider and normalizer"
```

---

### Task 7: Sync domain (upsert games, respect override, sync_runs)

**Files:**
- Create: `src/domain/sync.ts`
- Test: `tests/domain/sync.integration.test.ts`
- Modify: optional inject `fetchEspnWeek` for tests

**Interfaces:**
- Produces:
  - `syncWeek(week: number, opts?: { force?: boolean }): Effect<SyncResult, NflApiError>`
  - `syncSeasonWeeks(weeks?: number[]): Effect<…>` (1–18 or subset)
  - `maybeThrottledSync(week: number): Effect<…>` using `NFL_SYNC_MIN_INTERVAL_SEC` and latest `sync_runs`
- Upsert by `externalId`; if existing `winnerOverride === true`, keep DB `winnerTeam` while updating other fields
- Never delete picks

- [ ] **Step 1: Integration test with mock provider**

Inject games array into `upsertNormalizedGames(games)` pure DB function; assert override preserved.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: NFL week sync upsert with winner override"
```

---

### Task 8: Picks domain + API

**Files:**
- Create: `src/domain/picks.ts`, `src/app/api/picks/route.ts`
- Test: `tests/domain/picks.integration.test.ts`

**Interfaces:**
- Produces:
  - `savePicks(input: { userId; week; picks: { gameId; pickedTeam }[]; now: Date }): Effect<{ saved: number; lockedGameIds: string[] }, …>`
    - For each pick: load game; if locked → collect `GameLocked` id and skip; else validate `pickedTeam` is home or away; upsert
    - If all locked and none saved, fail with first `GameLocked` or return locked list with 409 policy: **prefer 200 with `{ saved, lockedGameIds }`** so partial saves work; document in API
  - `getWeekPicksView(input: { userId; week; now }): Effect<WeekPicksView>`
    - `games[]` with lock flag
    - `myPicks: Record<gameId, team>`
    - `revealedPicks: { gameId; userId; displayName; pickedTeam; correct?: boolean }[]` only for games where `canRevealPicks`
    - trigger `maybeThrottledSync(week)` before read (errors soft-fail: still return DB data + `staleWarning`)

- [ ] **Step 1: Tests — save open, reject locked, reveal filter**

- [ ] **Step 2: Implement + GET/POST `/api/picks?week=`**

POST body:

```json
{ "week": 1, "picks": [{ "gameId": "…", "pickedTeam": "KC" }] }
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: save and view weekly picks with lock and reveal rules"
```

---

### Task 9: Leaderboard domain + API

**Files:**
- Create: `src/domain/leaderboard.ts`, `src/app/api/leaderboard/route.ts`
- Test: `tests/domain/leaderboard.integration.test.ts`

**Interfaces:**
- Produces: `getLeaderboard(opts: { seasonYear; week?: number }): Effect<LeaderboardRow[]>`
- Row: `{ userId, displayName, points, correct, finalGames, rank }`
- Filter final games by season (and week if set); include all users with role player or all users; missed pick counts as 0 toward `finalGames` denominator
- Soft sync optional for current week when no week filter

- [ ] **Step 1: Test aggregation + competition ranks with two users**

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: season and weekly leaderboard aggregation"
```

---

### Task 10: App shell UI — picks + leaderboard + account

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/nav.tsx`,  
  `src/app/(app)/picks/page.tsx`, `src/components/picks-board.tsx`,  
  `src/app/(app)/leaderboard/page.tsx`, `src/components/leaderboard-table.tsx`,  
  `src/app/(app)/account/page.tsx`
- Modify: `src/app/page.tsx` → redirect logged-in users to `/picks`

**Interfaces:**
- Client components fetch APIs with credentials
- Picks UI: week selector 1–18, list games, two-option pick, Save button, show locked badge, show revealed brothers’ picks under each locked game
- Leaderboard: table with rank, name, points, record; optional week query param
- Account: change password form + logout button

- [ ] **Step 1: Build shell nav (Picks | Leaderboard | Account | Admin if commissioner)**

- [ ] **Step 2: Picks board wired to GET/POST**

- [ ] **Step 3: Leaderboard table**

- [ ] **Step 4: Manual smoke**

```bash
DATABASE_URL=file:./data/local.db npm run db:apply
# seed after Task 11 or insert manually
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: picks, leaderboard, and account UI"
```

---

### Task 11: Admin API + UI + seed script

**Files:**
- Create: `src/app/api/admin/users/route.ts`, `setup-token/route.ts`, `sync/route.ts`, `override-winner/route.ts`,  
  `src/app/(app)/admin/page.tsx`, `src/components/admin-panel.tsx`, `scripts/seed.ts`
- Test: commissioner-only checks in integration tests

**Interfaces:**
- `GET/POST /api/admin/users` — list / create `{ email, displayName, role }`
- `POST /api/admin/setup-token` `{ userId }` → `{ url: "/setup?token=RAW", rawToken }` (show once)
- `POST /api/admin/sync` `{ week?: number }` — sync one week or 1–18
- `POST /api/admin/override-winner` `{ gameId, winnerTeam }` — set winner + `winnerOverride=true` (winnerTeam null clears override path carefully: set override false only if clearing intentionally; v1: set team + override true)
- Seed: commissioner `commissioner@example.com` / password from env `SEED_COMMISSIONER_PASSWORD` default `changeme`; 2–3 player users without passwords + print setup tokens in console

- [ ] **Step 1: Implement APIs with `requireCommissioner`**

- [ ] **Step 2: Admin UI**

- [ ] **Step 3: Seed script**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: commissioner admin, seed script, sync and override"
```

---

### Task 12: Render deploy + README

**Files:**
- Create: `render.yaml`, `README.md`
- Modify: `.env.example` if needed

**Interfaces:**
- Produces deployable blueprint

- [ ] **Step 1: `render.yaml`**

```yaml
databases:
  - name: kan-nfl-db
    plan: basic-256mb
    databaseName: kan_nfl
    user: kan_nfl

services:
  - type: web
    name: kan-nfl-2
    runtime: node
    plan: starter
    region: oregon
    branch: main
    autoDeploy: true
    buildCommand: npm ci --include=dev && npm run build
    startCommand: npm run start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: kan-nfl-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true
      - key: SEASON_YEAR
        sync: false
```

- [ ] **Step 2: README**

Document local setup, seed, setup links, sync behavior, ESPN dependency, Render steps (`db:apply` + `seed` in shell), env vars.

- [ ] **Step 3: Full verification**

```bash
npm test
npm run build
DATABASE_URL=file:./data/local.db npm run db:reset-local
SEED_COMMISSIONER_PASSWORD='test-pass-123' npm run seed
```

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: README and Render blueprint for kan-nfl-2.0"
```

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|------------------|------|
| Multi-user password auth + setup token | 4, 5, 11 |
| Login/logout + change password | 5, 10 |
| Picks page + all games + per-game lock | 2, 8, 10 |
| Reveal after kickoff | 2, 8, 10 |
| Derived scoring / leaderboard / competition rank | 2, 9, 10 |
| Free API auto scores | 6, 7, 11 |
| Winner override | 7, 11 |
| Dual DB + Render | 3, 12 |
| Effect domain errors | 2, 5, 8, 9 |
| No AI / no playoffs | Global constraints |
| Current week derivation | 2, 8 |
| Throttled sync on load | 7, 8 |

## Placeholder / consistency notes

- ESPN query string locked to regular season `seasontype=2`; if live response shape differs, update mapper + fixture only (Task 6).
- Partial pick save returns **200** with `lockedGameIds` (Task 8) — consistent across API and UI.
- Session field names: `userId`, `role`, `email`, `isLoggedIn` everywhere.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-kan-nfl-pickem.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with `executing-plans`, checkpoints between batches  

Which approach?
