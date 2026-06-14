import { validateBracket } from '../../lib/validate.js';
import { buildBracketPayload } from './bracketPicks.js';

export async function submitBracket({ state, matchups, knockout, appsScriptUrl, dispatch, onClearDraft }) {
  const picks = buildBracketPayload(state, matchups, knockout);
  const submission = { identity: state.identity, picks };
  const { valid, errors } = validateBracket(submission, knockout);
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
        name: state.identity.name, email: state.identity.email, secret: state.identity.secret,
        picks, phase: 'knockout', client_version: '2',
      }),
    });
    const data = await res.json();
    if (data.error === 'locked') return dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: 'Bracket submissions are closed. Visit the leaderboard.' });
    if (data.error === 'secret_mismatch') return dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: "A bracket already exists for this email and the secret doesn't match. Use your bracket secret, or a different email." });
    if (!data.ok) return dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: `Couldn't save: ${data.error || 'unknown error'}.` });
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'submitted', submittedAt: data.submitted_at });
    onClearDraft?.();
  } catch {
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: "Couldn't save. Your bracket is still here — try again." });
  }
}
