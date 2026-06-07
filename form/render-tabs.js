import { getState, setActiveGroup } from './state.js';

let fixtures = null;
let container = null;

export function initTabs(rootEl, fixturesData) {
  fixtures = fixturesData;
  container = document.createElement('div');
  container.className = 'tabs';
  rootEl.appendChild(container);
  render();
}

export function renderTabs() { render(); }

function render() {
  if (!container || !fixtures) return;
  const state = getState();
  const letters = Object.keys(fixtures.groups).sort();
  container.innerHTML = '';
  for (const letter of letters) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    const status = completionStatus(letter, state.matches, fixtures);
    if (status === 'partial') tab.classList.add('partial');
    if (status === 'complete') tab.classList.add('complete');
    if (state.activeGroup === letter) tab.classList.add('active');

    const indicator = document.createElement('span');
    indicator.className = 'tab-indicator';
    indicator.textContent = status === 'complete' ? '✓' : status === 'partial' ? '●' : '';

    tab.appendChild(document.createTextNode(`Group ${letter}`));
    tab.appendChild(indicator);
    tab.addEventListener('click', () => setActiveGroup(letter));
    container.appendChild(tab);
  }
}

export function completionStatus(letter, matches, fixturesData) {
  const matchIds = fixturesData.groups[letter].matches;
  let filled = 0;
  for (const mid of matchIds) {
    const pick = matches[mid];
    if (pick && Number.isInteger(pick.home_score) && Number.isInteger(pick.away_score)) {
      filled++;
    }
  }
  if (filled === 0) return 'empty';
  if (filled === matchIds.length) return 'complete';
  return 'partial';
}

export function totalCompletion(matches, fixturesData) {
  const totalMatches = Object.keys(fixturesData.matches).length;
  let filled = 0;
  for (const mid of Object.keys(fixturesData.matches)) {
    const p = matches[mid];
    if (p && Number.isInteger(p.home_score) && Number.isInteger(p.away_score)) filled++;
  }
  return { filled, totalMatches };
}
