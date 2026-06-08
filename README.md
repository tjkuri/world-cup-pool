# World Cup 2026 Pool

Static-site prediction pool for the 2026 FIFA World Cup. Group stage v1; bracket challenge v2 (planned).

Live at https://world-cup-pool.tjkuri99.workers.dev.

Stack: React 19 + Vite 6 + Tailwind v4. Backend is a Google Apps Script web app writing to a Google Sheet. Cron-fetched ESPN results land in `public/results.json`. Cached implied probabilities from The Odds API land in `public/odds.json`.

See `docs/HANDOFF.md` for current state and `docs/superpowers/specs/` for design docs.

## Local development

```sh
npm run dev        # vite dev server on :5173 (form) and :5173/leaderboard.html
npm run build      # production build to dist/
npm test           # unit tests for lib/ (36 currently)
```

## Ops scripts

```sh
npm run seed       # one-time: fetch and commit public/fixtures.json (done)
npm run fetch      # update public/results.json from ESPN (cron runs this)
npm run cache-odds # update public/odds.json from The Odds API (manual)
                   # needs ODDS_API_KEY env var
```

## Deployment

- Frontend: Cloudflare Pages via Workers Builds, auto-deploys on every push to `main`. Configured in `wrangler.toml`.
- Apps Script: deployed manually from `apps_script/Code.gs`. See `apps_script/README.md`.
- Results cron: `.github/workflows/fetch-results.yml`, runs every 2hrs during the tournament window.
