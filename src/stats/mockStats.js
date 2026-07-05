// Minimal fixtures so the stats page is developable without live data.
// Two entrants, three snapshots. Shapes mirror the real files.
export const mockStats = {
  config: { apps_script_url: '', buy_in_usd: 30 },
  fixtures: { groups: {}, matches: {} },
  knockout: { rounds: { R32: [], R16: [], QF: [], SF: [], F: [] } },
  results: { updated_at: new Date().toISOString(), matches: {} },
  submissions: [
    { email_hash: 'h1', name: 'Ana', phase: 'group', picks: { matches: {}, group_standings: {} } },
    { email_hash: 'h2', name: 'Bo', phase: 'group', picks: { matches: {}, group_standings: {} } },
  ],
  history: {
    built_at: new Date().toISOString(),
    snapshots: [
      { t: '2026-06-15T00:00:00Z', standings: [
        { email_hash: 'h1', name: 'Ana', groupTotal: 12, bracketTotal: 0, total: 12 },
        { email_hash: 'h2', name: 'Bo', groupTotal: 9, bracketTotal: 0, total: 9 },
      ] },
      { t: '2026-06-25T00:00:00Z', standings: [
        { email_hash: 'h1', name: 'Ana', groupTotal: 40, bracketTotal: 0, total: 40 },
        { email_hash: 'h2', name: 'Bo', groupTotal: 44, bracketTotal: 0, total: 44 },
      ] },
      { t: '2026-07-03T00:00:00Z', standings: [
        { email_hash: 'h1', name: 'Ana', groupTotal: 40, bracketTotal: 60, total: 100 },
        { email_hash: 'h2', name: 'Bo', groupTotal: 44, bracketTotal: 40, total: 84 },
      ] },
    ],
  },
};
