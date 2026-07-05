import { useEffect, useState } from 'react';
import { mockStats } from './mockStats.js';

export function useStatsData() {
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mockStats') === '1') {
      setState({ loading: false, error: null, ...mockStats });
      return;
    }
    (async () => {
      try {
        const [config, fixtures, results] = await Promise.all([
          fetch('/config.json').then((x) => x.json()),
          fetch('/fixtures.json').then((x) => x.json()),
          fetch('/results.json').then((x) => x.json()),
        ]);
        const knockout = await fetch('/knockout.json').then((x) => (x.ok ? x.json() : null)).catch(() => null);
        const history = await fetch('/history.json').then((x) => (x.ok ? x.json() : null)).catch(() => null);
        let submissions = [];
        try {
          const data = await fetch(`${config.apps_script_url}?action=submissions`).then((x) => x.json());
          submissions = data.locked ? data.submissions : [];
        } catch { /* leave empty; charts degrade */ }
        setState({ loading: false, error: null, config, fixtures, results, knockout, history, submissions });
      } catch (e) {
        setState({ loading: false, error: String(e) });
      }
    })();
  }, []);

  return state;
}
