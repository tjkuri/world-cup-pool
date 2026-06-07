export function LockBanner({ lockTime, now }) {
  const ms = lockTime - now;
  const dayMs = 24 * 60 * 60 * 1000;
  if (ms <= 0 || ms > dayMs) return null;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  return (
    <div className="lock-banner">
      Submissions close in {hours}h {minutes}m {seconds}s
    </div>
  );
}
