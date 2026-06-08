import { useRef } from 'react';
import { useFormState } from '../state.jsx';

export function ClearPicksButton({ onClearDraft }) {
  const { dispatch } = useFormState();
  const dialogRef = useRef(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function confirmClear() {
    dispatch({ type: 'CLEAR_PICKS' });
    onClearDraft?.();
    close();
  }

  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={open}
        className="rounded-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-300"
      >
        Clear all picks
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit max-h-[90vh] w-[min(90vw,400px)] rounded-lg bg-slate-900 p-0 text-slate-100 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      >
        <div className="border-b border-slate-800 px-5 py-3">
          <h2 className="text-base font-semibold">Clear all picks?</h2>
        </div>
        <div className="px-5 py-4 text-sm text-slate-300">
          <p>This wipes every match score and tiebreaker drag. Your name, email, and secret stay.</p>
          <p className="mt-2 text-slate-400">You can't undo this.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmClear}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-400"
          >
            Yes, clear picks
          </button>
        </div>
      </dialog>
    </div>
  );
}
