import { createContext, useContext, useReducer } from 'react';

const initial = {
  matches: {},
  manualTiebreakers: {},
  identity: { name: '', email: '', secret: '', acknowledged: false },
  activeGroup: 'A',
  errors: [],
  submitState: 'idle',
  submitMessage: '',
  submittedAt: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MATCH_SCORE': {
      const { matchId, side, value } = action;
      const prior = state.matches[matchId] || { home_score: null, away_score: null };
      return {
        ...state,
        matches: { ...state.matches, [matchId]: { ...prior, [side]: value } },
      };
    }
    case 'SET_MANUAL_TIEBREAKER':
      return {
        ...state,
        manualTiebreakers: { ...state.manualTiebreakers, [action.group]: { ...action.ranks } },
      };
    case 'CLEAR_MANUAL_TIEBREAKER': {
      const next = { ...state.manualTiebreakers };
      delete next[action.group];
      return { ...state, manualTiebreakers: next };
    }
    case 'CLEAR_PICKS':
      return { ...state, matches: {}, manualTiebreakers: {}, errors: [] };
    case 'SET_IDENTITY':
      return { ...state, identity: { ...state.identity, ...action.patch } };
    case 'SET_ACTIVE_GROUP':
      return { ...state, activeGroup: action.letter };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SET_SUBMIT_STATE':
      return {
        ...state,
        submitState: action.value,
        submitMessage: action.message ?? '',
        submittedAt: action.submittedAt ?? state.submittedAt,
      };
    case 'HYDRATE':
      if (!action.payload || typeof action.payload !== 'object') return state;
      return {
        ...state,
        matches: action.payload.matches && typeof action.payload.matches === 'object' ? action.payload.matches : state.matches,
        manualTiebreakers: action.payload.manualTiebreakers && typeof action.payload.manualTiebreakers === 'object' ? action.payload.manualTiebreakers : state.manualTiebreakers,
        identity: action.payload.identity && typeof action.payload.identity === 'object' ? { ...state.identity, ...action.payload.identity } : state.identity,
        activeGroup: typeof action.payload.activeGroup === 'string' ? action.payload.activeGroup : state.activeGroup,
      };
    default:
      return state;
  }
}

const StateCtx = createContext(null);

export function FormStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <StateCtx.Provider value={{ state, dispatch }}>{children}</StateCtx.Provider>;
}

export function useFormState() {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error('useFormState must be used inside FormStateProvider');
  return ctx;
}
