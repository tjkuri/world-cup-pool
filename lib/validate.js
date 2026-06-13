import { KO_ROUND_ORDER } from './bracket.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSubmission(input, fixtures) {
  const errors = [];
  const { identity, picks } = input;

  // Identity
  if (!identity || typeof identity.name !== 'string' || identity.name.trim().length === 0 || identity.name.length > 40) {
    errors.push({ code: 'identity_name', message: 'Name must be 1–40 characters.' });
  }
  if (!identity || typeof identity.email !== 'string' || !EMAIL_RE.test(identity.email)) {
    errors.push({ code: 'identity_email', message: 'Email is not valid.' });
  }
  if (!identity || typeof identity.secret !== 'string' || identity.secret.length < 4) {
    errors.push({ code: 'identity_secret', message: 'Secret must be at least 4 characters.' });
  }
  if (!identity || identity.acknowledged !== true) {
    errors.push({ code: 'identity_acknowledged', message: 'Please acknowledge before submitting.' });
  }

  // Matches: every fixture must have a pick with valid scores.
  for (const matchId of Object.keys(fixtures.matches)) {
    const pick = picks?.matches?.[matchId];
    if (!pick) {
      errors.push({ code: 'match_missing', matchId, message: `Missing prediction for ${matchId}` });
      continue;
    }
    for (const side of ['home_score', 'away_score']) {
      const v = pick[side];
      if (!Number.isFinite(v)) {
        errors.push({ code: 'score_missing', matchId, side, message: `Missing ${side} for ${matchId}` });
      } else if (!Number.isInteger(v)) {
        errors.push({ code: 'score_not_integer', matchId, side, message: `${side} must be an integer` });
      } else if (v < 0 || v > 20) {
        errors.push({ code: 'score_out_of_range', matchId, side, message: `${side} must be between 0 and 20` });
      }
    }
  }

  // Group standings: 4 distinct teams per group, all in the group.
  for (const groupLetter of Object.keys(fixtures.groups)) {
    const standings = picks?.group_standings?.[groupLetter];
    const groupTeams = new Set(fixtures.groups[groupLetter].teams);
    if (!Array.isArray(standings) || standings.length !== 4) {
      errors.push({ code: 'standings_wrong_length', group: groupLetter, message: `Group ${groupLetter} standings must have exactly 4 entries` });
      continue;
    }
    const seen = new Set();
    for (const code of standings) {
      if (!groupTeams.has(code)) {
        errors.push({ code: 'standings_unknown_team', group: groupLetter, team: code, message: `${code} is not in group ${groupLetter}` });
      }
      if (seen.has(code)) {
        errors.push({ code: 'standings_duplicate', group: groupLetter, team: code, message: `Duplicate team ${code} in group ${groupLetter}` });
      }
      seen.add(code);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateBracket(input, knockout) {
  const errors = [];
  const { identity, picks } = input;

  if (!identity || typeof identity.name !== 'string' || identity.name.trim().length === 0 || identity.name.length > 40) {
    errors.push({ code: 'identity_name', message: 'Name must be 1–40 characters.' });
  }
  if (!identity || typeof identity.email !== 'string' || !EMAIL_RE.test(identity.email)) {
    errors.push({ code: 'identity_email', message: 'Email is not valid.' });
  }
  if (!identity || typeof identity.secret !== 'string' || identity.secret.length < 4) {
    errors.push({ code: 'identity_secret', message: 'Secret must be at least 4 characters.' });
  }
  if (!identity || identity.acknowledged !== true) {
    errors.push({ code: 'identity_acknowledged', message: 'Please acknowledge before submitting.' });
  }

  const bracket = picks?.bracket || {};
  let finalSlotId = null;
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      if (round === 'F') finalSlotId = slot.slot;
      const pick = bracket[slot.slot];
      if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
        errors.push({ code: 'slot_incomplete', slot: slot.slot, message: `Fill in the score for ${slot.slot}.` });
        continue;
      }
      for (const v of [pick.home_score, pick.away_score]) {
        if (v < 0 || v > 20) {
          errors.push({ code: 'score_out_of_range', slot: slot.slot, message: `${slot.slot} score must be 0–20.` });
        }
      }
      if (!pick.advances) {
        errors.push({ code: 'slot_no_advancer', slot: slot.slot, message: `Pick who advances from ${slot.slot}.` });
      }
    }
  }

  if (finalSlotId) {
    const finalPick = bracket[finalSlotId];
    if (finalPick && picks?.champion && finalPick.advances && picks.champion !== finalPick.advances) {
      errors.push({ code: 'champion_mismatch', message: 'Champion must be the winner of the final.' });
    }
    if (!picks?.champion) {
      errors.push({ code: 'champion_missing', message: 'Pick a champion.' });
    }
  }

  return { valid: errors.length === 0, errors };
}
