import { useEffect, useRef } from 'react';

const KEY = 'wc-draft';
const DEBOUNCE_MS = 500;

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}

export function useAutosave(state) {
  const timerRef = useRef(null);
  const snapshotRef = useRef(null);

  // Keep the latest snapshot in a ref so blur/visibility handlers see fresh data.
  snapshotRef.current = {
    matches: state.matches,
    manualTiebreakers: state.manualTiebreakers,
    identity: state.identity,
    activeGroup: state.activeGroup,
  };

  // Debounced save on state changes.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(snapshotRef.current));
      } catch {
        // noop
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.matches, state.manualTiebreakers, state.identity, state.activeGroup]);

  // Immediate save on lifecycle events.
  useEffect(() => {
    const saveNow = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(snapshotRef.current));
      } catch {
        // noop
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    window.addEventListener('blur', saveNow);
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', saveNow);
      window.removeEventListener('beforeunload', saveNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
