import { validateSubmission } from '../../lib/validate.js';
import { computeStandings } from '../../lib/standings.js';

export async function submitPicks({ state, fixtures, appsScriptUrl, dispatch, onClearDraft }) {
  const groupStandings = {};
  for (const letter of Object.keys(fixtures.groups)) {
    const group = fixtures.groups[letter];
    const matchScores = {};
    let complete = true;
    for (const mid of group.matches) {
      const pick = state.matches[mid];
      if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
        complete = false;
        break;
      }
      matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
    }
    if (!complete) {
      dispatch({
        type: 'SET_ERRORS',
        errors: [{ code: 'standings_incomplete', group: letter, message: `Group ${letter} standings are incomplete (missing scores).` }],
      });
      return;
    }
    const { standings, unresolvedTies } = computeStandings(letter, matchScores, fixtures, state.manualTiebreakers[letter]);
    if (unresolvedTies.length > 0) {
      dispatch({
        type: 'SET_ERRORS',
        errors: [{ code: 'standings_tied', group: letter, message: `Group ${letter} has unresolved ties — drag to rank the tied teams.` }],
      });
      return;
    }
    groupStandings[letter] = standings;
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
      headers: { 'Content-Type': 'application/json' },
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
