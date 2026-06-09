import { useEffect, useState } from 'react';

const CACHE_KEY = 'wc-pot-count';
const CACHE_TTL_MS = 60_000;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { count, at } = JSON.parse(raw);
    if (typeof count !== 'number' || Date.now() - at > CACHE_TTL_MS) return null;
    return count;
  } catch { return null; }
}

function writeCache(count) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() })); } catch {}
}

export function PotBar({ appsScriptUrl, buyIn }) {
  const [count, setCount] = useState(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!appsScriptUrl || !buyIn) return;
    // Dev-only escape hatch: ?mockCount=12 in the URL bypasses the fetch.
    const mock = new URLSearchParams(window.location.search).get('mockCount');
    if (mock !== null && !Number.isNaN(Number(mock))) {
      setCount(Number(mock));
      return;
    }
    const cached = readCache();
    if (cached !== null) {
      setCount(cached);
      return;
    }
    let cancelled = false;
    fetch(`${appsScriptUrl}?action=count`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.count === 'number') {
          setCount(data.count);
          writeCache(data.count);
        } else {
          setErrored(true);
        }
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => { cancelled = true; };
  }, [appsScriptUrl, buyIn]);

  if (errored || !buyIn) return null;

  const pot = (count ?? 0) * buyIn;
  const loading = count === null;

  return (
    <div className="mb-4 rounded-lg border border-emerald-500/30 bg-gradient-to-r from-slate-900 to-emerald-950/30 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="text-lg" aria-hidden="true">💰</span>
          <span>
            {loading ? (
              <span className="text-slate-500">Loading pot…</span>
            ) : (
              <>
                <span className="font-semibold text-slate-100 tabular-nums">{count}</span>{' '}
                {count === 1 ? 'entrant' : 'entrants'}
                <span className="text-slate-500"> × ${buyIn}</span>
              </>
            )}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pot so far</div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums">
            {loading ? '—' : `$${pot.toLocaleString()}`}
          </div>
        </div>
      </div>
    </div>
  );
}
