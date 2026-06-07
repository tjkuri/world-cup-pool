# World Cup 2026 Pool

Static-site prediction pool for the 2026 FIFA World Cup. Group stage v1; bracket challenge v2.

See `docs/superpowers/specs/2026-06-07-world-cup-pool-design.md` for full design.

## Local development

```sh
npm test           # run unit tests for lib/
npm run seed       # one-time: fetch and commit fixtures.json
npm run fetch      # update results.json from ESPN
```

## Deployment

- Static site is served by GitHub Pages from `main` branch root.
- Apps Script is deployed manually from `apps_script/Code.gs` (see file comments).
- Results cron lives at `.github/workflows/fetch-results.yml`.
