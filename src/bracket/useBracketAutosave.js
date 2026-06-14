import { useEffect, useRef } from 'react';

const KEY = 'wc-bracket-draft';
const DEBOUNCE_MS = 500;

export function loadBracketDraft() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearBracketDraft() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export function useBracketAutosave(state) {
  const timerRef = useRef(null);
  const snapshotRef = useRef(null);
  snapshotRef.current = {
    bracket: state.bracket, champion: state.champion,
    identity: state.identity, activeRound: state.activeRound,
  };
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(snapshotRef.current)); } catch { /* noop */ }
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.bracket, state.champion, state.identity, state.activeRound]);
  useEffect(() => {
    const saveNow = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      try { localStorage.setItem(KEY, JSON.stringify(snapshotRef.current)); } catch { /* noop */ }
    };
    const onVis = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('blur', saveNow);
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', saveNow);
      window.removeEventListener('beforeunload', saveNow);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
