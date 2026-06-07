import { renderLeaderboardTable } from './render-table.js';
import { openPickModal } from './modal.js';
import { wireDeepLinks } from './deep-link.js';
import { initRulesViewer } from '../shared/rules-viewer.js';

async function main() {
  const root = document.getElementById('leaderboard-root');
  const [config, fixtures, results] = await Promise.all([
    fetch('./config.json').then(r => r.json()),
    fetch('./fixtures.json').then(r => r.json()),
    fetch('./results.json').then(r => r.json()),
  ]);

  // Last-updated banner.
  const updatedEl = document.getElementById('results-updated');
  updatedEl.textContent = `Last updated: ${formatRelative(new Date(results.updated_at))}`;

  // Fetch submissions from Apps Script. Pre-lock → empty.
  let payload;
  try {
    const submissionsResp = await fetch(`${config.apps_script_url}?action=submissions`);
    const data = await submissionsResp.json();
    payload = { fixtures, results, submissions: data.locked ? data.submissions : [] };
    if (!data.locked) {
      root.innerHTML = `<p>The leaderboard goes live after submissions close at ${config.group_lock_iso}.</p>`;
      initRulesViewer({ triggerEl: document.getElementById('rules-button'), overlayEl: document.getElementById('rules-overlay') });
      return;
    }
  } catch (err) {
    root.innerHTML = `<p>Couldn't load submissions. <button id="retry">Retry</button></p>`;
    document.getElementById('retry').addEventListener('click', () => location.reload());
    return;
  }

  renderLeaderboardTable(root, payload, (entry, ctx) => openPickModal(entry, ctx));
  wireDeepLinks(payload, root);

  initRulesViewer({
    triggerEl: document.getElementById('rules-button'),
    overlayEl: document.getElementById('rules-overlay'),
  });
}

function formatRelative(date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

main().catch(err => {
  console.error(err);
  document.getElementById('leaderboard-root').innerHTML = `<p>Failed to load. Please refresh.</p>`;
});
