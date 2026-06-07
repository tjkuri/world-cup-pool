import { getState, setMatchScore } from './state.js';
import { deriveWinner } from '../lib/derive.js';

let fixtures = null;
let container = null;

export function initMatches(rootEl, fixturesData) {
  fixtures = fixturesData;
  container = document.createElement('div');
  container.className = 'matches-panel';
  rootEl.appendChild(container);
  render();
}

export function renderMatches() { render(); }

function render() {
  if (!container || !fixtures) return;
  const state = getState();
  const letter = state.activeGroup;
  const group = fixtures.groups[letter];
  if (!group) {
    container.innerHTML = `<p>Unknown group: ${letter}</p>`;
    return;
  }
  container.innerHTML = `<h2>Group ${letter}</h2>`;
  for (const mid of group.matches) {
    const fixture = fixtures.matches[mid];
    const pick = state.matches[mid] || { home_score: null, away_score: null };
    const row = document.createElement('div');
    row.className = 'match-row';
    row.dataset.matchId = mid;

    const homeLabel = document.createElement('div');
    homeLabel.className = 'team team-home';
    homeLabel.textContent = fixture.home;

    const homeInput = document.createElement('input');
    homeInput.type = 'number';
    homeInput.min = '0';
    homeInput.max = '20';
    homeInput.step = '1';
    homeInput.value = pick.home_score == null ? '' : String(pick.home_score);
    homeInput.addEventListener('input', (e) => {
      const raw = e.target.value;
      const v = raw === '' ? null : parseInt(raw, 10);
      setMatchScore(mid, 'home_score', Number.isFinite(v) ? v : null);
    });

    const drawLabel = document.createElement('div');
    drawLabel.className = 'draw-label';
    drawLabel.textContent = labelFor(pick);

    const awayInput = document.createElement('input');
    awayInput.type = 'number';
    awayInput.min = '0';
    awayInput.max = '20';
    awayInput.step = '1';
    awayInput.value = pick.away_score == null ? '' : String(pick.away_score);
    awayInput.addEventListener('input', (e) => {
      const raw = e.target.value;
      const v = raw === '' ? null : parseInt(raw, 10);
      setMatchScore(mid, 'away_score', Number.isFinite(v) ? v : null);
    });

    const awayLabel = document.createElement('div');
    awayLabel.className = 'team team-away';
    awayLabel.textContent = fixture.away;

    row.appendChild(homeLabel);
    row.appendChild(homeInput);
    row.appendChild(drawLabel);
    row.appendChild(awayInput);
    row.appendChild(awayLabel);
    container.appendChild(row);
  }
}

function labelFor(pick) {
  if (!Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) return 'vs';
  const winner = deriveWinner(pick.home_score, pick.away_score);
  return winner === 'draw' ? 'Draw' : winner === 'home' ? '←' : '→';
}
