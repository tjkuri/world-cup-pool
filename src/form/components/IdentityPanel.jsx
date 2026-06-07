import { useFormState } from '../state.jsx';
import { submitPicks } from '../submit.js';

export function IdentityPanel({ fixtures, appsScriptUrl, onClearDraft }) {
  const { state, dispatch } = useFormState();
  const id = state.identity;
  const setId = (patch) => dispatch({ type: 'SET_IDENTITY', patch });

  const submitting = state.submitState === 'submitting';

  return (
    <div className="identity-panel">
      <h2>Submit your picks</h2>

      <label>
        Name
        <input type="text" value={id.name} onChange={(e) => setId({ name: e.target.value })} />
      </label>

      <label>
        Email
        <input type="email" value={id.email} onChange={(e) => setId({ email: e.target.value.toLowerCase() })} />
      </label>

      <label>
        Secret (min 4 chars — protects your picks from impersonation)
        <input type="password" value={id.secret} onChange={(e) => setId({ secret: e.target.value })} />
      </label>

      <label style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={id.acknowledged}
          onChange={(e) => setId({ acknowledged: e.target.checked })}
        />
        {' '}I understand my secret protects my picks. Save it somewhere.
      </label>

      <div>
        <button
          type="button"
          className="submit-button"
          disabled={submitting}
          onClick={() => submitPicks({ state, fixtures, appsScriptUrl, dispatch, onClearDraft })}
        >
          {submitting ? 'Submitting…' : 'Submit picks'}
        </button>
      </div>

      {state.submitState === 'error' && state.submitMessage && (
        <p className="error-inline" style={{ marginTop: 8 }}>{state.submitMessage}</p>
      )}
    </div>
  );
}
