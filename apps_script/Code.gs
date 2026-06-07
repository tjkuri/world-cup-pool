// World Cup Pool — Apps Script backend.
// Paste this entire file into a Google Apps Script project bound to the pool
// spreadsheet. See apps_script/README.md for deployment instructions.
//
// The spreadsheet must have a sheet named "submissions" with this header row:
//   submitted_at | name | email | secret_hash | phase | picks_json | client_version
//
// Required script properties (Project Settings → Script properties):
//   salt              random hex string, e.g. 32 chars from crypto.randomUUID()
//   group_lock_iso    e.g. "2026-06-11T16:00:00Z" — paste from seed-fixtures output
//
// Endpoints:
//   POST /exec       body { name, email, secret, picks, phase?, client_version? }
//                    → 200 { ok: true, submitted_at }
//                    → 403 { error: "locked" }
//                    → 403 { error: "secret_mismatch" }
//                    → 400 { error: "bad_request", detail }
//   GET  /exec?action=submissions
//                    → { locked: false, submissions: [] }      (pre-lock)
//                    → { locked: true,  submissions: [...] }   (post-lock)

const SHEET_NAME = 'submissions';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const lockTime = getLockTime();
    if (new Date() >= lockTime) {
      return jsonResponse(403, { error: 'locked' });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const secret = String(body.secret || '');
    const picks = body.picks;
    const phase = String(body.phase || 'group');
    const clientVersion = String(body.client_version || '1');

    if (!name || !email || !secret || !picks) {
      return jsonResponse(400, { error: 'bad_request', detail: 'name, email, secret, picks required' });
    }

    const salt = getSalt();
    const secretHash = sha256Hex(salt + secret);

    const sheet = getSheet();
    const latest = findLatestByEmail(sheet, email);
    if (latest && latest.secret_hash !== secretHash) {
      return jsonResponse(403, { error: 'secret_mismatch' });
    }

    const submittedAt = new Date().toISOString();
    sheet.appendRow([
      submittedAt,
      name,
      email,
      secretHash,
      phase,
      JSON.stringify(picks),
      clientVersion,
    ]);
    return jsonResponse(200, { ok: true, submitted_at: submittedAt });
  } catch (err) {
    return jsonResponse(500, { error: 'server_error', message: String(err) });
  }
}

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || '';
    if (action !== 'submissions') {
      return jsonResponse(400, { error: 'unknown_action' });
    }
    const lockTime = getLockTime();
    const locked = new Date() >= lockTime;
    if (!locked) {
      return jsonResponse(200, { locked: false, submissions: [] });
    }
    const sheet = getSheet();
    const submissions = collectLatestPerEmail(sheet);
    return jsonResponse(200, { locked: true, submissions });
  } catch (err) {
    return jsonResponse(500, { error: 'server_error', message: String(err) });
  }
}

// --- helpers ---

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  return sheet;
}

function getLockTime() {
  const iso = PropertiesService.getScriptProperties().getProperty('group_lock_iso');
  if (!iso) throw new Error('group_lock_iso script property is unset');
  return new Date(iso);
}

function getSalt() {
  const salt = PropertiesService.getScriptProperties().getProperty('salt');
  if (!salt) throw new Error('salt script property is unset');
  return salt;
}

function sha256Hex(input) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function findLatestByEmail(sheet, email) {
  const data = sheet.getDataRange().getValues();
  // data[0] is the header row.
  let latest = null;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmail = String(row[2] || '').toLowerCase();
    if (rowEmail !== email) continue;
    const submittedAt = String(row[0] || '');
    if (!latest || submittedAt > latest.submitted_at) {
      latest = {
        submitted_at: submittedAt,
        name: row[1],
        email: rowEmail,
        secret_hash: String(row[3] || ''),
        phase: String(row[4] || ''),
        picks_json: String(row[5] || ''),
      };
    }
  }
  return latest;
}

function collectLatestPerEmail(sheet) {
  const data = sheet.getDataRange().getValues();
  const latestByEmail = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = String(row[2] || '').toLowerCase();
    if (!email) continue;
    const submittedAt = String(row[0] || '');
    if (!latestByEmail[email] || submittedAt > latestByEmail[email].submitted_at) {
      latestByEmail[email] = {
        submitted_at: submittedAt,
        name: String(row[1] || ''),
        email,
        phase: String(row[4] || ''),
        picks_json: String(row[5] || ''),
      };
    }
  }
  return Object.values(latestByEmail).map(s => ({
    name: s.name,
    email_hash: sha256Hex(s.email),
    phase: s.phase,
    picks: JSON.parse(s.picks_json),
    submitted_at: s.submitted_at,
  }));
}

function jsonResponse(status, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script web apps cannot set arbitrary HTTP status codes for
  // GET/POST without using the older HtmlService trick. Clients should rely on
  // payload.error or payload.ok rather than HTTP status. The `status` argument
  // here is informational only.
}
