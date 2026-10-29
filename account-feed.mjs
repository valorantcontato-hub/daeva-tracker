import { accountIdentity, normalizeAccountState } from './js/account-model.js';

export function createAccountFeed(emit = () => {}) {
  const states = new Map();
  return {
    snapshot: () => [...states.values()],
    ingest(message) {
      const state = normalizeAccountState(message);
      if (!state) throw Object.assign(new Error('Dados de conta inválidos'), { status: 400 });
      const key = accountIdentity(state.self), old = states.get(key);
      if (old && ((old.flowId === state.flowId && old.revision >= state.revision) || Date.parse(old.capturedAt) > Date.parse(state.capturedAt))) return;
      if (states.size >= 32 && !states.has(key)) states.delete(states.keys().next().value);
      states.set(key, state);
      emit(state);
    },
  };
}
