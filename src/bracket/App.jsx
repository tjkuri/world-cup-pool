import { useEffect, useState } from 'react';
import { BracketStateProvider } from './state.jsx';
import { BracketBody } from './BracketBody.jsx';

export function App() {
  const [config, setConfig] = useState(null);
  const [knockout, setKnockout] = useState(undefined); // undefined=loading, null=not seeded
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const mock = new URLSearchParams(location.search).get('mockKnockout') === '1';
    const koUrl = mock ? '/knockout.sample.json' : '/knockout.json';
    fetch('/config.json').then((r) => r.json()).then(setConfig).catch((e) => setLoadError(String(e)));
    fetch(koUrl).then((r) => (r.ok ? r.json() : null)).then((k) => setKnockout(k)).catch(() => setKnockout(null));
  }, []);

  if (loadError) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><p>Failed to load: {loadError}. Refresh to retry.</p></main>;
  }
  if (!config || knockout === undefined) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><p className="text-slate-400">Loading…</p></main>;
  }
  return (
    <BracketStateProvider>
      <BracketBody config={config} knockout={knockout} />
    </BracketStateProvider>
  );
}
