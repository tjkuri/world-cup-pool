// Central state for the submission form. No framework — just a plain object
// behind subscribe/notify. Mutating helpers are explicit so all writes funnel
// through one place. Subscribers get the new state on every change.

const listeners = new Set();

const initial = {
  // matches: { [matchId]: { home_score: number|null, away_score: number|null } }
  matches: {},
  // manualTiebreakers: { [groupLetter]: { [teamCode]: rank } }
  manualTiebreakers: {},
  // identity: { name, email, secret, acknowledged }
  identity: { name: '', email: '', secret: '', acknowledged: false },
  // activeGroup: which tab is currently visible
  activeGroup: 'A',
  // errors: from the last validate pass; rendered by validation-ui.js
  errors: [],
  // submission state machine
  submitState: 'idle', // 'idle' | 'submitting' | 'submitted' | 'error'
  submitMessage: '',
  submittedAt: null,
  // tournament gate
  locked: false,
};

let state = structuredClone(initial);

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

// --- mutating helpers ---

export function setMatchScore(matchId, side, value) {
  const next = { ...state.matches };
  const prior = next[matchId] || { home_score: null, away_score: null };
  next[matchId] = { ...prior, [side]: value };
  state = { ...state, matches: next };
  notify();
}

export function setManualTiebreaker(groupLetter, ranks) {
  // ranks: { [teamCode]: rank }, or {} to clear.
  const next = { ...state.manualTiebreakers, [groupLetter]: { ...ranks } };
  state = { ...state, manualTiebreakers: next };
  notify();
}

export function clearManualTiebreaker(groupLetter) {
  const next = { ...state.manualTiebreakers };
  delete next[groupLetter];
  state = { ...state, manualTiebreakers: next };
  notify();
}

export function setIdentity(patch) {
  state = { ...state, identity: { ...state.identity, ...patch } };
  notify();
}

export function setActiveGroup(letter) {
  state = { ...state, activeGroup: letter };
  notify();
}

export function setErrors(errors) {
  state = { ...state, errors };
  notify();
}

export function setSubmitState(submitState, opts = {}) {
  state = { ...state, submitState, submitMessage: opts.message || '', submittedAt: opts.submittedAt || state.submittedAt };
  notify();
}

export function setLocked(locked) {
  state = { ...state, locked };
  notify();
}

// Hydrate from a saved draft. Defensive: only copies fields we expect.
export function hydrate(saved) {
  if (!saved || typeof saved !== 'object') return;
  state = {
    ...state,
    matches: saved.matches && typeof saved.matches === 'object' ? saved.matches : state.matches,
    manualTiebreakers: saved.manualTiebreakers && typeof saved.manualTiebreakers === 'object' ? saved.manualTiebreakers : state.manualTiebreakers,
    identity: saved.identity && typeof saved.identity === 'object' ? { ...state.identity, ...saved.identity } : state.identity,
    activeGroup: typeof saved.activeGroup === 'string' ? saved.activeGroup : state.activeGroup,
  };
  notify();
}

// Reset to a pristine initial state. Used after a successful submit.
export function reset() {
  state = structuredClone(initial);
  notify();
}
