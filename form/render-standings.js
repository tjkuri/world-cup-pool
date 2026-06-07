import { getState, setManualTiebreaker, clearManualTiebreaker } from './state.js';
import { computeStandings } from '../lib/standings.js';

let fixtures = null;
let container = null;

export function initStandings(rootEl, fixturesData) {
  fixtures = fixturesData;
  container = document.createElement('div');
  container.className = 'standings-panel';
  rootEl.appendChild(container);
  render();
}

export function renderStandings() { render(); }

// Lookup: the standings the form is "committing to" for a group, given the
// current match scores plus any user-provided manual tiebreaker ranks.
// Used by identity-and-submit.js to assemble the final picks payload.
export function getDerivedStandings(letter) {
  const state = getState();
  const matchScores = {};
  for (const mid of fixtures.groups[letter].matches) {
    const pick = state.matches[mid];
    if (!pick) return null; // not all matches filled — no commitment yet
    if (!Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) return null;
    matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
  }
  const manual = state.manualTiebreakers[letter] || undefined;
  const { standings, unresolvedTies } = computeStandings(letter, matchScores, fixtures, manual);
  if (unresolvedTies.length > 0) return null; // still ties to resolve
  return standings;
}

function render() {
  if (!container || !fixtures) return;
  const state = getState();
  const letter = state.activeGroup;
  const group = fixtures.groups[letter];
  container.innerHTML = '<h3>Predicted standings</h3>';

  // Build match scores from current state. Skip groups that aren't filled enough.
  const matchScores = {};
  let allFilled = true;
  for (const mid of group.matches) {
    const pick = state.matches[mid];
    if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
      allFilled = false;
      break;
    }
    matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
  }

  if (!allFilled) {
    container.innerHTML += '<p class="loading">Fill in all 6 match scores to see the predicted standings.</p>';
    return;
  }

  const manual = state.manualTiebreakers[letter];
  const { standings, unresolvedTies } = computeStandings(letter, matchScores, fixtures, manual);

  const list = document.createElement('ol');
  list.className = 'standings-list';
  for (let i = 0; i < standings.length; i++) {
    const li = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'standings-rank';
    rank.textContent = `${i + 1}.`;
    const team = document.createElement('span');
    team.textContent = standings[i];
    li.appendChild(rank);
    li.appendChild(team);
    list.appendChild(li);
  }
  container.appendChild(list);

  if (unresolvedTies.length > 0) {
    container.appendChild(renderTiebreakerWidget(letter, unresolvedTies));
  }
}

function renderTiebreakerWidget(letter, tiedGroups) {
  const widget = document.createElement('div');
  widget.className = 'tiebreaker-widget';
  const explain = document.createElement('p');
  explain.innerHTML = `<strong>Tie to break.</strong> The scores you entered leave teams tied. Use the arrows to rank them, top → bottom.`;
  widget.appendChild(explain);

  const state = getState();
  const existingManual = state.manualTiebreakers[letter] || {};

  // Render each tied subset independently. Each subset is an array of teams in
  // their current heuristic order. We let the user reorder within the subset.
  let rankOffset = 0;
  // Find the starting rank for the first tied group by scanning standings.
  // To keep this simple, assume tied groups appear in standings order and we
  // just use the user's reordering relative to them.
  for (const subset of tiedGroups) {
    const subsetEl = document.createElement('div');
    subsetEl.className = 'tiebreaker-subset';
    // Use the existing manual order if all subset teams have ranks already,
    // otherwise the heuristic alphabetical fallback from standings.
    const ordered = sortSubsetForUI(subset, existingManual);
    for (let i = 0; i < ordered.length; i++) {
      const pill = document.createElement('span');
      pill.className = 'tiebreaker-pill';
      pill.textContent = ordered[i];
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.textContent = '↑';
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', () => moveTeam(letter, ordered, i, -1));
      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.textContent = '↓';
      downBtn.disabled = i === ordered.length - 1;
      downBtn.addEventListener('click', () => moveTeam(letter, ordered, i, 1));
      pill.appendChild(document.createTextNode(' '));
      pill.appendChild(upBtn);
      pill.appendChild(downBtn);
      subsetEl.appendChild(pill);
    }
    widget.appendChild(subsetEl);
  }
  return widget;
}

function sortSubsetForUI(subset, existingManual) {
  return [...subset].sort((a, b) => {
    const ra = Number.isFinite(existingManual[a]) ? existingManual[a] : Infinity;
    const rb = Number.isFinite(existingManual[b]) ? existingManual[b] : Infinity;
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function moveTeam(letter, ordered, idx, delta) {
  const next = [...ordered];
  const swapIdx = idx + delta;
  if (swapIdx < 0 || swapIdx >= next.length) return;
  const tmp = next[idx]; next[idx] = next[swapIdx]; next[swapIdx] = tmp;
  // Build manualTiebreakers from the new order. We assign ranks starting at 1.
  const state = getState();
  const existing = { ...(state.manualTiebreakers[letter] || {}) };
  next.forEach((team, i) => { existing[team] = i + 1; });
  setManualTiebreaker(letter, existing);
}

// Note: clearing manualTiebreakers when match scores change (per spec §5.3.1)
// is handled in form/main.js by watching for matches-state diffs and calling
// clearManualTiebreaker(letter) directly. No helper needed here.
