export function deriveWinner(homeScore, awayScore) {
  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
    throw new TypeError('deriveWinner requires two numbers');
  }
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}
