import { getState, setIdentity, setErrors, setSubmitState } from './state.js';
import { validateSubmission } from '../lib/validate.js';
import { getDerivedStandings } from './render-standings.js';
import { clearDraft } from './autosave.js';

let fixtures = null;
let appsScriptUrl = null;
let container = null;
let submittedView = null;

export function initIdentityAndSubmit(rootEl, fixturesData, config) {
  fixtures = fixturesData;
  appsScriptUrl = config.apps_script_url;
  container = document.createElement('div');
  container.className = 'identity-panel';
  rootEl.appendChild(container);

  submittedView = document.createElement('div');
  submittedView.className = 'submitted-view';
  submittedView.hidden = true;
  rootEl.appendChild(submittedView);

  render();
}

export function renderIdentityAndSubmit() { render(); }

function render() {
  const state = getState();
  if (state.submitState === 'submitted') {
    renderSubmittedView(state);
    container.style.display = 'none';
    submittedView.hidden = false;
    return;
  }
  container.style.display = '';
  submittedView.hidden = true;

  container.innerHTML = '<h2>Submit your picks</h2>';

  const fieldName = field('Name', 'text', state.identity.name, v => setIdentity({ name: v }));
  const fieldEmail = field('Email', 'email', state.identity.email, v => setIdentity({ email: v.toLowerCase() }));
  const fieldSecret = field('Secret (min 4 chars — protects your picks from impersonation)', 'password', state.identity.secret, v => setIdentity({ secret: v }));

  const ackLabel = document.createElement('label');
  const ack = document.createElement('input');
  ack.type = 'checkbox';
  ack.checked = state.identity.acknowledged;
  ack.addEventListener('change', e => setIdentity({ acknowledged: e.target.checked }));
  ackLabel.appendChild(ack);
  ackLabel.appendChild(document.createTextNode(' I understand my secret protects my picks. Save it somewhere.'));

  container.appendChild(fieldName);
  container.appendChild(fieldEmail);
  container.appendChild(fieldSecret);
  container.appendChild(ackLabel);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'submit-button';
  submitBtn.textContent = state.submitState === 'submitting' ? 'Submitting…' : 'Submit picks';
  submitBtn.disabled = state.submitState === 'submitting' || state.locked;
  submitBtn.addEventListener('click', () => onSubmit());
  container.appendChild(submitBtn);

  if (state.submitState === 'error' && state.submitMessage) {
    const errEl = document.createElement('p');
    errEl.className = 'error-inline';
    errEl.textContent = state.submitMessage;
    container.appendChild(errEl);
  }
}

function field(labelText, type, value, onChange) {
  const wrapper = document.createElement('label');
  wrapper.textContent = labelText;
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.addEventListener('input', e => onChange(e.target.value));
  wrapper.appendChild(input);
  return wrapper;
}

function renderSubmittedView(state) {
  submittedView.innerHTML = `
    <h2>Picks submitted</h2>
    <p>Recorded at <strong>${state.submittedAt}</strong>.</p>
    <p>You can re-submit until lock to update your picks — use the same email + secret.</p>
    <p><a href="./leaderboard.html">View leaderboard</a> (it goes live at kickoff).</p>
  `;
}

async function onSubmit() {
  // Assemble standings from derived values. Bail if any group still has an
  // unresolved tie or incomplete scores.
  const groupStandings = {};
  for (const letter of Object.keys(fixtures.groups)) {
    const s = getDerivedStandings(letter);
    if (!s) {
      setErrors([{ code: 'standings_incomplete', group: letter,
        message: `Group ${letter} standings are incomplete (missing scores or unresolved tie).` }]);
      return;
    }
    groupStandings[letter] = s;
  }

  const state = getState();
  const submission = {
    identity: state.identity,
    picks: {
      matches: state.matches,
      group_standings: groupStandings,
    },
  };
  const { valid, errors } = validateSubmission(submission, fixtures);
  setErrors(errors);
  if (!valid) {
    setSubmitState('error', { message: 'Please fix the errors above before submitting.' });
    return;
  }

  setSubmitState('submitting');
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
        client_version: '1',
      }),
    });
    const data = await res.json();
    if (data.error === 'locked') {
      setSubmitState('error', { message: `Submissions are closed. Visit the leaderboard.` });
      return;
    }
    if (data.error === 'secret_mismatch') {
      setSubmitState('error', { message: `An entry already exists for this email. The secret you provided doesn't match. If this is your entry, use the secret you set before. If it's not you, use a different email.` });
      return;
    }
    if (!data.ok) {
      setSubmitState('error', { message: `Couldn't save: ${data.error || 'unknown error'}.` });
      return;
    }
    setSubmitState('submitted', { submittedAt: data.submitted_at });
    clearDraft();
  } catch (err) {
    setSubmitState('error', { message: `Couldn't save. Your picks are still here — try again.` });
  }
}
