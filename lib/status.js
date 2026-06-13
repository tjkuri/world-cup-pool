// ESPN soccer returns STATUS_FULL_TIME for matches that ended at full time;
// STATUS_FINAL shows up for other contexts (and some endpoints/sports). Treat
// both as "match is over and the stored home/away scores are authoritative."
//
// Knockout-stage statuses (extra time, penalty shootout) will need to be added
// here when the v2 backend ships — that's the point of having one chokepoint.
const FINAL_STATUSES = new Set([
  'STATUS_FINAL',
  'STATUS_FULL_TIME',
  'STATUS_FINAL_AET',   // knockout: decided after extra time
  'STATUS_FINAL_PEN',   // knockout: decided on penalties
]);

export function isMatchFinal(status) {
  return FINAL_STATUSES.has(status);
}
