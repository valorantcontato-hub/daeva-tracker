import { normalizeCollection, collectionIdentity } from './js/collection-state.js';
export function createPetFeed(onState = () => {}) {
  const states = new Map(), clients = new Set();
  return {
    ingest(message) {
      const state = normalizeCollection(message);
      if (!state) throw Object.assign(new Error('Coleção inválida'), {status:400});
      const key = collectionIdentity(state.self), previous = states.get(key);
      if (previous && ((previous.flowId === state.flowId && previous.revision >= state.revision) ||
          Date.parse(previous.capturedAt) > Date.parse(state.capturedAt))) return;
      if (states.size >= 32 && !states.has(key)) states.delete(states.keys().next().value);
      states.set(key,state);
      onState(state);
      for (const response of clients) response.write(`data: ${JSON.stringify(state)}\n\n`);
    },
    snapshot() { return [...states.values()]; },
    subscribe(req,res) {
      res.writeHead(200, {'content-type':'text/event-stream','cache-control':'no-store',connection:'keep-alive'});
      res.write(`data: ${JSON.stringify([...states.values()])}\n\n`);
      clients.add(res);
      req.on('close',()=>clients.delete(res));
    },
  };
}
