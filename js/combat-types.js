import { DUMMY_CODES, DUMMY_NAMES } from './data/training-dummies.js';
export const isTrainingDummy = fight => !!fight && (fight.isDummy === true || DUMMY_CODES.has(Number(fight.npcCode)) || DUMMY_NAMES.has(String(fight.boss || '').trim().toLowerCase()));
export const isBossEncounter = fight => !!fight && fight.isBoss === true && !isTrainingDummy(fight);
