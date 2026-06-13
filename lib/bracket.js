// lib/bracket.js
// Pure connected-bracket logic, shared by the entry UI and the scorer.
import { isMatchFinal } from './status.js';

export const KO_ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];

// Team code that won by score, or null on a tie (a tie needs an explicit
// advancer — pens during entry, ESPN's winner flag for actual results).
export function winnerCode(home, away, homeScore, awayScore) {
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return home;
  if (awayScore > homeScore) return away;
  return null;
}

// slot -> { home, away } for every round. advancerForSlot(slot) returns the
// team advancing from a given slot (or null if undecided).
export function resolveMatchups(knockout, advancerForSlot) {
  const teams = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      if (round === 'R32') {
        teams[slot.slot] = { home: slot.home, away: slot.away };
      } else {
        const [a, b] = slot.from;
        teams[slot.slot] = { home: advancerForSlot(a) ?? null, away: advancerForSlot(b) ?? null };
      }
    }
  }
  return teams;
}

// Walk the real results round by round. For each slot resolve its two teams
// (R32 from knockout.json, later rounds from prior actual advancers), then its
// actual advancer (results.advances if present, else derived from score; null
// if the match isn't final yet).
export function resolveActualBracket(knockout, results) {
  const advancers = {};
  const matchInfo = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const home = round === 'R32' ? slot.home : (advancers[slot.from[0]] ?? null);
      const away = round === 'R32' ? slot.away : (advancers[slot.from[1]] ?? null);
      const r = slot.match_id ? results?.matches?.[slot.match_id] : null;
      const final = !!(r && isMatchFinal(r.status));
      let advances = null;
      if (final) {
        advances = r.advances ?? winnerCode(home, away, r.home_score, r.away_score);
      }
      advancers[slot.slot] = advances;
      matchInfo[slot.slot] = {
        home, away,
        home_score: r?.home_score ?? null,
        away_score: r?.away_score ?? null,
        advances, final,
      };
    }
  }
  return { advancers, matchInfo };
}
