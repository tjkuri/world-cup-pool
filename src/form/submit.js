import { validateSubmission } from '../../lib/validate.js';
import { resolveGroupStandings } from './resolveStandings.js';

export async function submitPicks({ state, fixtures, appsScriptUrl, dispatch, onClearDraft }) {
  const groupStandings = {};
  for (const letter of Object.keys(fixtures.groups)) {
    const res = resolveGroupStandings(letter, state, fixtures);
    if (!res.allFilled) {
      const message = `Group ${letter} standings can't be resolved — fill in the missing match scores.`;
      dispatch({ type: 'SET_ERRORS', errors: [{ code: 'standings_incomplete', group: letter, message }] });
      dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: 'Please fix the errors above before submitting.' });
      return;
    }
    groupStandings[letter] = res.standings;
  }

  const submission = {
    identity: state.identity,
    picks: { matches: state.matches, group_standings: groupStandings },
  };
  const { valid, errors } = validateSubmission(submission, fixtures);
  dispatch({ type: 'SET_ERRORS', errors });
  if (!valid) {
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: 'Please fix the errors above before submitting.' });
    return;
  }

  dispatch({ type: 'SET_SUBMIT_STATE', value: 'submitting' });
  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: state.identity.name,
        email: state.identity.email,
        secret: state.identity.secret,
        picks: { matches: state.matches, group_standings: groupStandings },
        phase: 'group',
        client_version: '2',
      }),
    });
    const data = await res.json();
    if (data.error === 'locked') {
      dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: 'Submissions are closed. Visit the leaderboard.' });
      return;
    }
    if (data.error === 'secret_mismatch') {
      dispatch({
        type: 'SET_SUBMIT_STATE',
        value: 'error',
        message: "An entry already exists for this email. The secret you provided doesn't match. If this is your entry, use the secret you set before. If it's not you, use a different email.",
      });
      return;
    }
    if (!data.ok) {
      dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: `Couldn't save: ${data.error || 'unknown error'}.` });
      return;
    }
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'submitted', submittedAt: data.submitted_at });
    onClearDraft?.();
  } catch {
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: "Couldn't save. Your picks are still here — try again." });
  }
}
