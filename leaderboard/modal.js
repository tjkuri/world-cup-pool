import { computeStandings } from '../lib/standings.js';
import { deriveWinner } from '../lib/derive.js';

const MODAL_ID = 'pick-modal';

export function openPickModal(entry, ctx) {
  const modal = document.getElementById(MODAL_ID);
  modal.innerHTML = '';
  modal.appendChild(buildContent(entry, ctx));
  modal.hidden = false;

  modal.addEventListener('click', onOutsideClick);
  document.addEventListener('keydown', onEsc);
  // Update URL fragment so it's shareable.
  history.replaceState(null, '', `#picks/${entry.email_hash}`);
}

function closeModal() {
  const modal = document.getElementById(MODAL_ID);
  modal.hidden = true;
  modal.removeEventListener('click', onOutsideClick);
  document.removeEventListener('keydown', onEsc);
  history.replaceState(null, '', location.pathname + location.search);
}

function onOutsideClick(e) {
  if (e.target.id === MODAL_ID) closeModal();
}

function onEsc(e) { if (e.key === 'Escape') closeModal(); }

function buildContent(entry, ctx) {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-content';

  const header = document.createElement('header');
  header.innerHTML = `
    <h2>${escapeHtml(entry.name)}'s picks</h2>
    <p>Total: <strong>${entry.scoring.total}</strong> · Match pts: ${entry.scoring.match_total} · Group pts: ${entry.scoring.group_total} · Exact scores: ${entry.scoring.exact_score_count}</p>
  `;
  wrapper.appendChild(header);

  for (const letter of Object.keys(ctx.fixtures.groups).sort()) {
    wrapper.appendChild(buildGroupCard(letter, entry, ctx));
  }

  const footer = document.createElement('footer');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', closeModal);
  footer.appendChild(close);
  wrapper.appendChild(footer);

  return wrapper;
}

function buildGroupCard(letter, entry, ctx) {
  const { fixtures, results } = ctx;
  const group = fixtures.groups[letter];
  const card = document.createElement('section');
  card.className = 'group-card';

  const groupPts = entry.scoring.group_points[letter]?.subtotal ?? 0;
  const matchPtsInGroup = group.matches.reduce((sum, mid) => sum + (entry.scoring.match_points[mid] || 0), 0);
  card.innerHTML = `<h3>Group ${letter} <small>· ${matchPtsInGroup + groupPts} pts</small></h3>`;

  for (const mid of group.matches) {
    card.appendChild(buildMatchRow(mid, entry, ctx));
  }

  card.appendChild(buildStandingsStrip(letter, entry, ctx));
  return card;
}

function buildMatchRow(mid, entry, ctx) {
  const fx = ctx.fixtures.matches[mid];
  const pick = entry.picks.matches[mid] || {};
  const result = ctx.results.matches[mid];
  const row = document.createElement('div');
  row.className = 'match-result-row';

  let cls = 'pending';
  if (result && result.status === 'STATUS_FINAL') {
    const pts = entry.scoring.match_points[mid];
    if (pts === 5) cls = 'exact';
    else if (pts === 3) cls = 'winner';
    else cls = 'wrong';
  }
  row.classList.add(cls);

  const predicted = `${pick.home_score ?? '–'}-${pick.away_score ?? '–'}`;
  const actual = result && result.status === 'STATUS_FINAL'
    ? `${result.home_score}-${result.away_score}`
    : '—';
  row.innerHTML = `
    <span>${escapeHtml(fx.home)}</span>
    <span><strong>${predicted}</strong> <small>(actual ${actual})</small></span>
    <span>${escapeHtml(fx.away)}</span>
  `;
  return row;
}

function buildStandingsStrip(letter, entry, ctx) {
  const strip = document.createElement('div');
  strip.className = 'standings-strip';
  const predicted = entry.picks.group_standings[letter] || [];

  // Has the group fully finalized? If so, compute actual standings to color the chips.
  const group = ctx.fixtures.groups[letter];
  const allFinal = group.matches.every(mid =>
    ctx.results?.matches?.[mid]?.status === 'STATUS_FINAL'
  );
  let actual = null;
  if (allFinal) {
    const matchScores = {};
    for (const mid of group.matches) {
      const r = ctx.results.matches[mid];
      matchScores[mid] = { home_score: r.home_score, away_score: r.away_score };
    }
    actual = computeStandings(letter, matchScores, ctx.fixtures).standings;
  }

  for (let i = 0; i < predicted.length; i++) {
    const chip = document.createElement('span');
    chip.className = 'standings-chip';
    chip.textContent = `${i + 1}. ${predicted[i]}`;
    if (actual && actual[i] === predicted[i]) chip.classList.add('correct');
    strip.appendChild(chip);
  }
  if (!allFinal) {
    const note = document.createElement('span');
    note.className = 'loading';
    note.textContent = ' (pending)';
    strip.appendChild(note);
  }
  return strip;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
