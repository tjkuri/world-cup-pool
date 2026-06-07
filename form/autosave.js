import { getState, subscribe } from './state.js';

const KEY = 'wc-draft';
const DEBOUNCE_MS = 500;

let timer = null;

function snapshot() {
  const s = getState();
  return {
    matches: s.matches,
    manualTiebreakers: s.manualTiebreakers,
    identity: s.identity,
    activeGroup: s.activeGroup,
  };
}

function saveNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
  } catch (err) {
    console.warn('Autosave failed:', err);
  }
}

function scheduleSave() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(saveNow, DEBOUNCE_MS);
}

export function initAutosave() {
  subscribe(scheduleSave);
  window.addEventListener('blur', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('beforeunload', saveNow);
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to load draft:', err);
    return null;
  }
}

export function clearDraft() {
  try { localStorage.removeItem(KEY); } catch {}
}
