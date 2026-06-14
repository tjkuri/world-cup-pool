import { createContext, useContext, useReducer } from 'react';

const initial = {
  bracket: {},   // slot -> { home, away, home_score, away_score, advances }
  champion: null,
  identity: { name: '', email: '', secret: '', acknowledged: false },
  activeRound: 'R32',
  errors: [],
  submitState: 'idle',
  submitMessage: '',
  submittedAt: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SLOT_SCORE': {
      const { slot, side, value, home, away } = action;
      const prior = state.bracket[slot] || { home, away, home_score: null, away_score: null, advances: null };
      const next = { ...prior, home, away, [side]: value };
      // Re-derive advancer from score unless it's a tie (then keep prior pens choice).
      if (Number.isInteger(next.home_score) && Number.isInteger(next.away_score)) {
        if (next.home_score > next.away_score) next.advances = home;
        else if (next.away_score > next.home_score) next.advances = away;
        // tie → leave next.advances as-is (set via SET_SLOT_ADVANCER)
      }
      return { ...state, bracket: { ...state.bracket, [slot]: next } };
    }
    case 'SET_SLOT_ADVANCER': {
      const prior = state.bracket[action.slot];
      if (!prior) return state;
      return { ...state, bracket: { ...state.bracket, [action.slot]: { ...prior, advances: action.team } } };
    }
    case 'SET_CHAMPION':
      return { ...state, champion: action.team };
    case 'CLEAR_BRACKET':
      return { ...state, bracket: {}, champion: null, errors: [] };
    case 'SET_IDENTITY':
      return { ...state, identity: { ...state.identity, ...action.patch } };
    case 'SET_ACTIVE_ROUND':
      return { ...state, activeRound: action.round };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SET_SUBMIT_STATE':
      return { ...state, submitState: action.value, submitMessage: action.message ?? '', submittedAt: action.submittedAt ?? state.submittedAt };
    case 'HYDRATE':
      if (!action.payload || typeof action.payload !== 'object') return state;
      return {
        ...state,
        bracket: action.payload.bracket && typeof action.payload.bracket === 'object' ? action.payload.bracket : state.bracket,
        champion: typeof action.payload.champion === 'string' ? action.payload.champion : state.champion,
        identity: action.payload.identity && typeof action.payload.identity === 'object' ? { ...state.identity, ...action.payload.identity } : state.identity,
        activeRound: typeof action.payload.activeRound === 'string' ? action.payload.activeRound : state.activeRound,
      };
    default:
      return state;
  }
}

const Ctx = createContext(null);
export function BracketStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
export function useBracketState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBracketState must be used inside BracketStateProvider');
  return ctx;
}
