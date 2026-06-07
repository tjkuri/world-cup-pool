import { useEffect } from 'react';
import { scoreSubmission } from '../../lib/score.js';

async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function useDeepLink({ fixtures, results, submissions, onOpen }) {
  useEffect(() => {
    if (!fixtures || !results || !submissions?.length) return;

    (async () => {
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

      const match = submissions.find((s) => s.email_hash.toLowerCase() === targetHash);
      if (!match) return;
      const scoring = scoreSubmission(match.picks, fixtures, results);
      onOpen({ ...match, scoring });
    })();
  }, [fixtures, results, submissions, onOpen]);
}
