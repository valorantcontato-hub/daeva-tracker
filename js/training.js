import { TrainingRun } from './training-model.js';
import { onSnapshot } from './live.js';
import { load, save } from './store.js';
import { getMe } from './profiles.js';
import { uid } from './util.js';

const scope = () => {
  const me = getMe();
  return 'training:' + JSON.stringify(me ? [me.region, me.serverId, me.characterId] : ['unlinked']);
};
const listeners = new Set();
let active = null, owner = '', latest = null, started = false, lastPaint = '', error = '';
const read = key => load(key, []);
function persist(key, run) {
  const list = read(key);
  const next = [run, ...list.filter(r => r.id !== run.id)];
  if (!save(key, next)) error = 'Não foi possível salvar o treino. Verifique o espaço disponível.';
}
function emit() { for (const fn of [...listeners]) fn(); }
function end(status, now) {
  active.finish(status, now);
  persist(owner, active.result(now));
  active = null;
  save('trainingActive', null);
  emit();
}

export function startTrainingRecorder() {
  if (started || window.top !== window || /^#\/w\//.test(location.hash)) return;
  started = true;
  const interrupted = load('trainingActive', null);
  if (interrupted?.run && interrupted.owner) {
    persist(interrupted.owner, { ...interrupted.run, status: 'interrupted' });
    save('trainingActive', null);
  }
  onSnapshot(snapshot => {
    latest = snapshot;
    if (active) {
      active.observe(snapshot, Date.now());
      if (!save('trainingActive', { owner, run: active.result(Date.now()) })) error = 'Não foi possível salvar o treino. Verifique o espaço disponível.';
    }
    emit();
  });
  setInterval(() => {
    const now = Date.now();
    if (active && owner !== scope()) end('interrupted', now);
    if (active && now >= active.endAt + 1500) end('completed', now);
    const phase = active?.phase(now) || 'idle';
    const marker = phase + ':' + Math.ceil((active ? (phase === 'countdown' ? active.startAt : active.endAt) - now : 0) / 1000);
    if (marker !== lastPaint) { lastPaint = marker; emit(); }
  }, 100);
}

export function trainingState() {
  const now = Date.now(), phase = active?.phase(now) || 'idle';
  const running = active?.result(now);
  return { phase, active: running, error, latest,
    remaining: active ? Math.max(0, Math.ceil(((phase === 'countdown' ? active.startAt : active.endAt) - now) / 1000)) : 0,
    runs: running ? [running, ...read(scope()).filter(r => r.id !== running.id)] : read(scope()) };
}
export function onTraining(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function addTraining(name, seconds) {
  name = String(name || '').trim(); seconds = Number(seconds);
  if (!name || name.length > 60 || !Number.isInteger(seconds) || seconds < 5 || seconds > 1800) throw new Error('Informe um nome e um tempo entre 5 e 1800 segundos.');
  const me = getMe();
  const run = { id: uid(), name, timeLimit: seconds, createdAt: new Date().toISOString(), status: 'ready', playerName: me?.name || '', class: me?.class || '', skills: [], damage: 0, dps: 0, duration: 0 };
  persist(scope(), run); emit(); return run.id;
}
export function startTraining(id) {
  if (active) throw new Error('Já existe um treino em andamento.');
  const plan = read(scope()).find(r => r.id === id && r.status === 'ready');
  if (!plan) throw new Error('Treino não disponível para iniciar.');
  owner = scope(); active = new TrainingRun(plan, Date.now());
  if (latest) active.observe(latest, Date.now());
  if (!save('trainingActive', { owner, run: active.result(Date.now()) })) error = 'Não foi possível salvar o treino. Verifique o espaço disponível.';
  emit();
}
export function cancelTraining() { if (active) end('cancelled', Date.now()); }
