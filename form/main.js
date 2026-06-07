import { getState, subscribe, hydrate, setLocked } from './state.js';
import { initTabs, renderTabs, totalCompletion } from './render-tabs.js';
import { initMatches, renderMatches } from './render-matches.js';
import { initStandings, renderStandings } from './render-standings.js';
import { initValidationUI, renderValidationUI } from './validation-ui.js';
import { initAutosave, loadDraft } from './autosave.js';
import { initIdentityAndSubmit, renderIdentityAndSubmit } from './identity-and-submit.js';
import { clearManualTiebreaker } from './state.js';
import { initRulesViewer } from '../shared/rules-viewer.js';

async function main() {
  const root = document.getElementById('form-root');
  const [config, fixtures] = await Promise.all([
    fetch('./config.json').then(r => r.json()),
    fetch('./fixtures.json').then(r => r.json()),
  ]);

  const now = new Date();
  const lock = new Date(config.group_lock_iso);
  setLocked(now >= lock);

  // Build the page chrome.
  root.innerHTML = '';
  const progress = renderProgressBar(fixtures);
  root.appendChild(progress);

  initValidationUI(root);
  initTabs(root, fixtures);
  initMatches(root, fixtures);
  initStandings(root, fixtures);
  initIdentityAndSubmit(root, fixtures, config);

  // Hydrate draft.
  hydrate(loadDraft());
  initAutosave();

  // Track which group's matches have changed so we can clear manual tiebreakers
  // when scores shift (per spec §5.3.1).
  let previousMatches = getState().matches;
  subscribe(() => {
    const next = getState().matches;
    if (next !== previousMatches) {
      const changedGroups = collectChangedGroups(previousMatches, next, fixtures);
      for (const g of changedGroups) clearManualTiebreaker(g);
      previousMatches = next;
    }
  });

  // Re-render on every change.
  subscribe(() => {
    renderTabs();
    renderMatches();
    renderStandings();
    renderValidationUI();
    renderIdentityAndSubmit();
    updateProgressBar(progress, fixtures);
    updateLockBanner(config);
  });

  // Initial render and lock-aware view.
  renderTabs();
  renderMatches();
  renderStandings();
  renderValidationUI();
  renderIdentityAndSubmit();
  updateProgressBar(progress, fixtures);
  updateLockBanner(config);

  initRulesViewer({
    triggerEl: document.getElementById('rules-button'),
    overlayEl: document.getElementById('rules-overlay'),
  });

  if (getState().locked) {
    showLockedView(root);
  }
}

function renderProgressBar(fixtures) {
  const el = document.createElement('div');
  el.className = 'progress';
  el.innerHTML = `<span class="progress-count" id="progress-count"></span>`;
  return el;
}

function updateProgressBar(progressEl, fixtures) {
  const { filled, totalMatches } = totalCompletion(getState().matches, fixtures);
  const countEl = progressEl.querySelector('#progress-count');
  countEl.textContent = `${filled} / ${totalMatches} match picks complete`;
}

function updateLockBanner(config) {
  const banner = document.getElementById('lock-banner');
  if (!banner) return;
  const lock = new Date(config.group_lock_iso);
  const now = new Date();
  const ms = lock - now;
  const dayMs = 24 * 60 * 60 * 1000;
  if (ms <= 0) {
    banner.hidden = true;
    return;
  }
  if (ms > dayMs) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  banner.textContent = `Submissions close in ${hours}h ${minutes}m ${seconds}s`;
  // Re-tick once a second.
  setTimeout(() => updateLockBanner(config), 1000);
}

function showLockedView(root) {
  root.innerHTML = `
    <h2>Submissions are closed.</h2>
    <p>The tournament has begun. <a href="./leaderboard.html">View the leaderboard.</a></p>
  `;
}

function collectChangedGroups(prev, next, fixtures) {
  const changed = new Set();
  const allMatchIds = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const mid of allMatchIds) {
    if (JSON.stringify(prev[mid] || null) !== JSON.stringify(next[mid] || null)) {
      const group = fixtures.matches[mid]?.group;
      if (group) changed.add(group);
    }
  }
  return [...changed];
}

main().catch(err => {
  console.error(err);
  document.getElementById('form-root').innerHTML = `<p>Failed to load. Please refresh.</p>`;
});
