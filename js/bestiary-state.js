// O catálogo é compartilhado; abates e favoritos pertencem ao personagem vinculado.
import { load, save } from './store.js';
import { getMe } from './profiles.js';

export const bestiaryKey = (profile = getMe()) => profile?.characterId
  ? 'bestiary:' + JSON.stringify([profile.region, String(profile.serverId), profile.characterId])
  : 'bestiary:unlinked';

export function readBestiary(profile = getMe()) {
  const key = bestiaryKey(profile);
  let state = load(key, null);
  if (!state) {
    const owner = load('bestiaryLegacyOwner', null);
    // Migra os dados antigos uma única vez, sem apagá-los ou repeti-los em outra conta.
    const claimUnlinked = profile?.characterId && owner === 'bestiary:unlinked';
    state = claimUnlinked ? load('bestiary:unlinked', { kills: {}, focus: [] })
      : !owner ? { kills: load('kills', {}), focus: load('focus', []) } : { kills: {}, focus: [] };
    save(key, state);
    if (!owner || claimUnlinked) save('bestiaryLegacyOwner', key);
  }
  return { kills: { ...state.kills }, focus: [...(state.focus || [])] };
}

export function writeBestiary(state, profile = getMe()) {
  const key = bestiaryKey(profile);
  const saved = save(key, { kills: state.kills || {}, focus: [...(state.focus || [])] });
  if (saved && !load('bestiaryLegacyOwner', null)) save('bestiaryLegacyOwner', key);
  return saved;
}

export function imageUrl(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
