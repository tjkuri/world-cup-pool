export function formatKickoff(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}
