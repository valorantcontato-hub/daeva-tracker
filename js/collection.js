import { load, save, notifyChange } from './store.js';
import { getMe } from './profiles.js';
import { collectionStorageKey, normalizeCollection, collectionIdentity } from './collection-state.js';
import { listenStream } from './stream.js';
let pets = [], started = false;
export const getPetCatalog = () => pets;
export const readCollection = (me = getMe()) => collectionIdentity(me) ? load(collectionStorageKey(me), null) : null;
export async function loadPetCatalog() {
  try {
    const response = await fetch('/js/data/pet-catalog.json');
    if (response.ok) pets = (await response.json()).pets || [];
  } catch { /* Capture data stays stored while offline. */ }
}
export function startCollection() {
  if (started || typeof EventSource === 'undefined') return;
  started = true;
  listenStream('pets', event => {
    let incoming; try { incoming = JSON.parse(event.data); } catch { return; }
    for (const message of Array.isArray(incoming) ? incoming : [incoming]) {
      const state = normalizeCollection(message);
      if (!state) continue;
      const previous = readCollection(state.self);
      if (previous && ((previous.flowId === state.flowId && previous.revision >= state.revision) ||
          Date.parse(previous.capturedAt) > Date.parse(state.capturedAt))) continue;
      if (save(collectionStorageKey(state.self), state)) notifyChange();
    }
  });
}
