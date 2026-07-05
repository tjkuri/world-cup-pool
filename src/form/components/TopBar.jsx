export function TopBar({ pageLabel, otherPage, otherLabel, onOpenRules, hideStatsLink, children }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
        <h1 className="text-base font-semibold text-slate-100">{pageLabel}</h1>
        <nav className="ml-auto flex items-center gap-2">
          <a
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            href={otherPage}
          >
            {otherLabel}
          </a>
          {!hideStatsLink && (
            <a
              className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              href="/stats.html"
            >
              Stats
            </a>
          )}
          <button
            type="button"
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            onClick={onOpenRules}
          >
            Rules
          </button>
        </nav>
        {children}
      </div>
    </header>
  );
}
