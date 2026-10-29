import { load, save, notifyChange } from './store.js';
import { getMe } from './profiles.js';
import { listenStream } from './stream.js';
import { accountIdentity, accountStorageKey, normalizeAccountState } from './account-model.js';

export const readAccountState = (me = getMe()) => accountIdentity(me) ? load(accountStorageKey(me), null) : null;
let started = false;
export function startAccountFeed() {
  if (started) return;
  started = true;
  listenStream('account', event => {
    let incoming; try { incoming = JSON.parse(event.data); } catch { return; }
    for (const value of Array.isArray(incoming) ? incoming : [incoming]) {
      const state = normalizeAccountState(value);
      if (!state) continue;
      const old = readAccountState(state.self);
      if (old && ((old.flowId === state.flowId && old.revision >= state.revision) || Date.parse(old.capturedAt) > Date.parse(state.capturedAt))) continue;
      if (save(accountStorageKey(state.self), state)) notifyChange();
    }
  });
}
