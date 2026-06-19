# Apps Script deployment

## One-time setup

1. Create a new Google Sheet titled "World Cup Pool".
2. In the sheet, rename the first tab to `submissions` and set the header row:
   `submitted_at | name | email | secret_hash | phase | picks_json | client_version`
   (Hint: paste this into A1:G1 as comma-separated then use Data → Split text to columns.)
3. Extensions → Apps Script. Delete any boilerplate code and paste the contents
   of `Code.gs` from this directory.
4. Project Settings (gear icon, left sidebar) → Script properties → Add:
   - `salt`: a random hex string (32+ chars; you can paste the output of
     `node -e "console.log(crypto.randomUUID().replaceAll('-',''))"`).
   - `group_lock_iso`: the earliest kickoff time printed by `npm run seed`,
     e.g. `2026-06-11T16:00:00Z`.
   - `knockout_lock_iso` (v2, add at knockout go-live ~Jun 27): the first R32
     kickoff printed by `node scripts/seed-knockout.mjs`. A `phase:'knockout'`
     POST gates on this property instead of `group_lock_iso`; if it's unset the
     server returns `400 lock_unset`, so set it before merging the bracket page.
5. Save the script. Click "Deploy" → "New deployment".
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Click Deploy and authorize the script when prompted.
6. Copy the resulting Web app URL — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.
7. Paste that URL into the repo's `config.json` as `apps_script_url`. Commit
   that change.

## Re-deploying after code changes

If you edit `Code.gs`:

1. Click Deploy → Manage deployments → pencil icon on the active deployment.
2. Set "Version" to "New version", click Deploy. The URL stays the same.

## Testing

- In the Apps Script editor, set the function dropdown to `doGet` and click
  Run. You'll be prompted to authorize on first run. The Logs panel should
  show the execution.
- For end-to-end testing: load the form from your local machine, submit a
  test entry, check the sheet for a new row, then re-submit with the wrong
  secret to confirm the `secret_mismatch` path.
