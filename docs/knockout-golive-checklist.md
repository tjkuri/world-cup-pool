# v2 Knockout Go-Live Checklist

Prepared 2026-06-27 (group stage ends tonight; first R32 match is **Jun 28 19:00Z**,
so there's a comfortable window — this does NOT have to finish tonight).
Working branch: `feat/v2-knockout-bracket`. Full runbook in `docs/HANDOFF.md`.

---

## ✅ Done this session

- [x] **Apps Script `Code.gs` deployed** (backward-compatible; group submissions verified
      unaffected — `count:24`, 24 group rows).
- [x] **Bug fixed: `?action=submissions` returned latest-per-email** → would have dropped a
      player's group picks once they submitted a knockout bracket. Now latest-per-(email,phase).
- [x] **Bug fixed: seed used a sequential bracket tree.** The 2026 bracket is NOT sequential
      (R16-1 ← R32 1&3, not 1&2). Seed rewritten to **derive the real wiring from ESPN**,
      populate match_id+kickoff for ALL rounds (the cron needs them), and drop the 3rd-place
      playoff. 7 seed tests + 69 lib tests pass; build clean.
- [x] **`config.json` `knockout_lock_iso` = `2026-06-28T19:00:00Z`** committed.
- [x] All fixes committed + pushed to `origin/feat/v2-knockout-bracket`.

## ✅ Manual step — DONE

- [x] Apps Script `knockout_lock_iso` = `2026-06-28T19:00:00Z` (verified: knockout POST returns
      `bad_request`, not `lock_unset`; lock correctly in the future; no stray rows).

---

## 🔴 When you're back tonight (~10 min, together)

Group stage will have resolved, so the seed's placeholder guard will pass.
You're already on `feat/v2-knockout-bracket`.

### 1. Seed the real bracket
```bash
git pull
node scripts/seed-knockout.mjs
```
- If it aborts with "unresolved teams", ESPN hasn't finished best-third seeding — wait, re-run.
- [ ] It prints the full R32→Final tree. **Glance at it vs the official bracket** (30 sec):
      do the R16 pairings look right? (This is the one thing not auto-verified — the seed
      assumes ESPN numbers R32 by match-id order, which it does, but eyeballs are cheap.)
```bash
git add public/knockout.json && git commit -m "seed knockout bracket" && git push
```

### 2. Merge to main → deploy
```bash
git checkout main && git merge feat/v2-knockout-bracket && git push
```
- [ ] CF Pages auto-deploys `bracket.html`.
- [ ] Smoke: live `/bracket.html` shows real R32 teams, entry open (lock is tomorrow 19:00Z).
- [ ] Smoke: live `/leaderboard.html` still loads.

---

## 🔵 After the first R32 match (Jun 28+)

- [ ] `public/results.json` gains knockout match IDs (760486+) with `advances` (cron every 2h).
- [ ] Verify `lib/status.js` AET/PEN strings (`STATUS_FINAL_AET` / `STATUS_FINAL_PEN` are
      best-guesses) against the first ET/penalty result; add any missing string.

---

### Pre-merge gate
knockout.json seeded with **real teams** + `knockout_lock_iso` set in **both** config.json
and the Apps Script property — confirm both before merging.
