import { DUMMY_CODES, DUMMY_NAMES } from './data/training-dummies.js';
import { FINAL_BOSSES } from './data/final-bosses.js';
const finalCodes = new Set(FINAL_BOSSES.flatMap(b => b.npcCodes));
const key = value => String(value || '').normalize('NFKC').toLowerCase().replace(/^the /,'').replace(/[^\p{L}\p{N}]+/gu,'');
export const isTrainingDummy = fight => !!fight && (fight.isDummy === true || DUMMY_CODES.has(Number(fight.npcCode)) || DUMMY_NAMES.has(String(fight.boss || '').trim().toLowerCase()));
export const isBossEncounter = fight => !!fight && fight.isBoss === true && !isTrainingDummy(fight);
/** Chefe dentro de uma DG instanciada (a captura informa a DG): chefes de mundo aberto e mobs comuns ficam de fora. */
export const isInstancedBossFight = fight => isBossEncounter(fight) && (Number(fight.dungeonId) > 0 || String(fight.dungeon || '').trim() !== '');
export function isFinalDungeonBoss(fight) {
  if (!isBossEncounter(fight)) return false;
  if (Number(fight.npcCode)) return finalCodes.has(Number(fight.npcCode));
  // Older saved encounters did not carry NPC codes. Restrict this fallback to a DG.
  return FINAL_BOSSES.some(b => key(b.name) === key(fight.boss) && key(b.dungeon) === key(fight.dungeon));
}
