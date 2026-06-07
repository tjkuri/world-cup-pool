export function TopBar({ pageLabel, otherPage, otherLabel, onOpenRules, children }) {
  return (
    <header className="top-bar">
      <h1>{pageLabel}</h1>
      <nav>
        <a href={otherPage}>{otherLabel}</a>
        <button type="button" onClick={onOpenRules}>📖 Rules</button>
      </nav>
      {children}
    </header>
  );
}
