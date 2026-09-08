# Kan NFL Pick’em 2.0

Private brother pick’em for the NFL regular season (weeks 1–18).

- **Auth:** allowlisted users, one-time setup link → password, self-service login/logout (iron-session, 90 days)
- **Picks:** per-game lock at kickoff; Trends show everyone’s picks at all times
- **Scores:** free ESPN scoreboard API (server-side), points derived from correct picks
- **Deploy:** Render web + Postgres (same shape as `ians-mcp`); local SQLite

Design: `docs/superpowers/specs/2026-08-08-kan-nfl-pickem-design.md`  
Plan: `docs/superpowers/plans/2026-08-08-kan-nfl-pickem.md`  
Product increment: `docs/superpowers/plans/2026-09-03-kan-nfl-product-increment.md`

## Product (signed in)

- **Home (`/`):** dashboard — avatar, display name, unpicked games left, next lock, quick links to Picks / Trends / Leaderboard
- **Trends (`/trends`):** week consensus and who-picked-what (visible before kickoff)
- **Account (`/account`):** change password, unique display name, preset avatar (32 NFL teams + 4 fun icons; no photo upload)
- **PWA:** Add to Home Screen from the browser (manifest + icons; no offline service worker required)

## Local setup

```bash
cp .env.example .env
# SESSION_SECRET must be >= 32 chars
# DATABASE_URL=file:./data/local.db
# SEASON_YEAR=2026

npm install
npm run db:apply
npm run seed
npm run dev
```

- Login: http://localhost:3000/login  
  - Commissioner (seed): `iandkaneshiro@gmail.com` / `changeme` (or `SEED_COMMISSIONER_PASSWORD`)
  - Seed prints `/setup?token=…` links for sample brothers
- Health: http://localhost:3000/api/health

```bash
npm test
npm run build
```

## Season ops

1. Admin → add brothers (email + display name)
2. Generate **Setup / reset link** and share once in the family chat
3. They set a password and use login all season
4. **Sync week** (or 1–18) after schedule is published; auto-sync also runs throttled on picks/leaderboard load
5. After MNF, sync again so finals/winners land; leaderboard updates automatically
6. Rare wrong score: Admin → pick a week → **Override winner** from that week’s game list (`AWAY @ HOME`); choose Home, Away, or Clear
7. Before first deploy with existing users, check for duplicate `display_name` values — `db:apply` logs a warning and continues if any exist

## Render

1. Blueprint: `render.yaml` (or Web Service + Postgres)
2. Build: `npm ci --include=dev && npm run build` · Start: `npm run db:apply && npm run seed && npm run start` · Health: `/api/health`
3. **Keep-alive (Render sleep):** free web services spin down after idle. Set an external HTTP monitor (UptimeRobot or cron-job.org) for `https://<service>.onrender.com/api/health` every **5 minutes** — that is the reliable option. Optional: add repo secret `KEEPALIVE_URL` (same URL) for the scheduled GitHub Action in `.github/workflows/keep-alive.yml` (`*/10` cron + manual dispatch). GitHub cron is **not** minute-accurate; do not rely on it alone.
4. Set `SEASON_YEAR` and confirm `SESSION_SECRET` / `DATABASE_URL`
5. Seed runs on boot (idempotent). First login: `iandkaneshiro@gmail.com` / `changeme`, then **Account → Change password**. If start command is set in the Render dashboard, update it to match step 2.

## Stack

Next.js 15 · Drizzle (Postgres / SQLite) · Effect · iron-session · bcryptjs · vitest · ESPN site API (no key)
