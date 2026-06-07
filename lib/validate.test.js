import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission } from './validate.js';

function singleGroupFixtures() {
  return {
    groups: {
      A: { teams: ['AAA','BBB','CCC','DDD'], matches: ['m01','m02','m03','m04','m05','m06'] }
    },
    matches: {
      m01: { group: 'A', home: 'AAA', away: 'BBB', kickoff_iso: '2026-06-11T00:00:00Z' },
      m02: { group: 'A', home: 'CCC', away: 'DDD', kickoff_iso: '2026-06-11T00:00:00Z' },
      m03: { group: 'A', home: 'AAA', away: 'CCC', kickoff_iso: '2026-06-11T00:00:00Z' },
      m04: { group: 'A', home: 'BBB', away: 'DDD', kickoff_iso: '2026-06-11T00:00:00Z' },
      m05: { group: 'A', home: 'AAA', away: 'DDD', kickoff_iso: '2026-06-11T00:00:00Z' },
      m06: { group: 'A', home: 'BBB', away: 'CCC', kickoff_iso: '2026-06-11T00:00:00Z' },
    }
  };
}

function validIdentity() {
  return { name: 'Tessa', email: 'tessa@example.com', secret: 'open-sesame', acknowledged: true };
}

function validPicks() {
  return {
    matches: {
      m01: { home_score: 1, away_score: 0 },
      m02: { home_score: 1, away_score: 0 },
      m03: { home_score: 1, away_score: 0 },
      m04: { home_score: 1, away_score: 0 },
      m05: { home_score: 1, away_score: 0 },
      m06: { home_score: 1, away_score: 0 },
    },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
}

test('valid submission passes', () => {
  const r = validateSubmission({ identity: validIdentity(), picks: validPicks() }, singleGroupFixtures());
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
});

test('missing a match is invalid', () => {
  const picks = validPicks();
  delete picks.matches.m03;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'match_missing' && e.matchId === 'm03'));
});

test('score below 0 is invalid', () => {
  const picks = validPicks();
  picks.matches.m01.home_score = -1;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'score_out_of_range' && e.matchId === 'm01'));
});

test('score above 20 is invalid', () => {
  const picks = validPicks();
  picks.matches.m01.home_score = 21;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'score_out_of_range' && e.matchId === 'm01'));
});

test('non-integer score is invalid', () => {
  const picks = validPicks();
  picks.matches.m01.home_score = 1.5;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'score_not_integer' && e.matchId === 'm01'));
});

test('duplicate team in standings is invalid', () => {
  const picks = validPicks();
  picks.group_standings.A = ['AAA','AAA','CCC','DDD'];
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'standings_duplicate' && e.group === 'A'));
});

test('non-group team in standings is invalid', () => {
  const picks = validPicks();
  picks.group_standings.A = ['AAA','BBB','CCC','ZZZ'];
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'standings_unknown_team' && e.group === 'A'));
});

test('wrong length standings array is invalid', () => {
  const picks = validPicks();
  picks.group_standings.A = ['AAA','BBB','CCC'];
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'standings_wrong_length' && e.group === 'A'));
});

test('missing name is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), name: '' },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_name'));
});

test('overlong name is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), name: 'x'.repeat(41) },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_name'));
});

test('bad email is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), email: 'not-an-email' },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_email'));
});

test('short secret is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), secret: 'abc' },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_secret'));
});

test('unacknowledged is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), acknowledged: false },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_acknowledged'));
});
