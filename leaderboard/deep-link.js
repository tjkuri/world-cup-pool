import { openPickModal } from './modal.js';

// Hash an email the same way the backend does (sha256 hex) so query-string
// filtering works without requiring the user to know their hash.
async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function wireDeepLinks(payload, rootEl) {
  const fragMatch = /^#picks\/([a-f0-9]+)$/i.exec(location.hash);
  let targetHash = null;
  if (fragMatch) {
    targetHash = fragMatch[1].toLowerCase();
  } else {
    const params = new URLSearchParams(location.search);
    const email = (params.get('email') || '').trim().toLowerCase();
    if (email) targetHash = await sha256Hex(email);
  }
  if (!targetHash) return;

  const { fixtures, results, submissions } = payload;
  // Find the matching submission and synthesize a scored entry.
  const { scoreSubmission } = await import('../lib/score.js');
  const match = submissions.find(s => s.email_hash.toLowerCase() === targetHash);
  if (!match) return;
  const scoring = scoreSubmission(match.picks, fixtures, results);
  const entry = { name: match.name, email_hash: match.email_hash, submitted_at: match.submitted_at, picks: match.picks, scoring };
  openPickModal(entry, { fixtures, results });
}
