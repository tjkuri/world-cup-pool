import { useEffect, useRef } from 'react';
import { useBracketState } from '../state.jsx';
import { submitBracket } from '../submit.js';
import { clearBracketDraft } from '../useBracketAutosave.js';
import { BracketTree } from '../../shared/bracketTree.jsx';
import { ErrorSummary } from '../../form/components/ErrorSummary.jsx';

export function BracketSubmitModal({ knockout, matchups, appsScriptUrl }) {
  const { state, dispatch } = useBracketState();
  const dialogRef = useRef(null);
  const submitting = state.submitState === 'submitting';

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  // Close the modal automatically once the submission succeeds.
  useEffect(() => {
    if (state.submitState === 'submitted') {
      dialogRef.current?.close();
    }
  }, [state.submitState]);

  const id = state.identity;
  const setId = (patch) => dispatch({ type: 'SET_IDENTITY', patch });

  const slotInfo = (slot) => {
    const m = matchups[slot] || {};
    return { home: m.home, away: m.away, advances: state.bracket[slot]?.advances ?? null };
  };

  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        className="rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
        onClick={openModal}
      >
        Submit bracket
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="bracket-submit-modal-title"
        className="fixed inset-0 m-auto h-fit max-h-[90vh] w-[min(90vw,520px)] rounded-lg bg-slate-900 p-0 text-slate-100 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
        onClick={(e) => { if (e.target === dialogRef.current) closeModal(); }}
        onClose={() => dispatch({ type: 'SET_SUBMIT_STATE', value: 'idle', message: null })}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 id="bracket-submit-modal-title" className="text-base font-semibold">Submit your bracket</h2>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </div>

        <div className="border-b border-slate-800 px-5 py-3 max-h-48 overflow-y-auto">
          <BracketTree knockout={knockout} slotInfo={slotInfo} />
        </div>

        <div className="space-y-3 px-5 py-4 overflow-y-auto">
          <ErrorSummary errors={state.errors} />

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Name</span>
            <input
              type="text"
              value={id.name}
              onChange={(e) => setId({ name: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Email</span>
            <input
              type="email"
              value={id.email}
              onChange={(e) => setId({ email: e.target.value.toLowerCase() })}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Secret (min 4 chars)</span>
            <input
              type="password"
              value={id.secret}
              onChange={(e) => setId({ secret: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="mt-1 block text-xs text-slate-500">Use any secret — if you forgot your group-stage one, set a new one here.</span>
          </label>

          <label className="flex items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={id.acknowledged}
              onChange={(e) => setId({ acknowledged: e.target.checked })}
              className="mt-1"
            />
            <span>I understand my secret protects my picks. Save it somewhere.</span>
          </label>

          {state.submitState === 'error' && state.submitMessage && (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
              {state.submitMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitBracket({ state, matchups, knockout, appsScriptUrl, dispatch, onClearDraft: clearBracketDraft })}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            {submitting ? 'Submitting…' : 'Submit bracket'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
