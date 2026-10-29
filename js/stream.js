// One HTTP stream per window. Three streams per window exhaust Chromium's
// per-host connection pool as soon as several overlays are enabled together.
const listeners = new Map();
let started = false;
const sources = [];
const deliver = (channel, event) => {
  for (const callback of [...(listeners.get(channel) || [])]) callback(event);
};

export function listenStream(channel, callback) {
  if (!listeners.has(channel)) listeners.set(channel, new Set());
  listeners.get(channel).add(callback);
  if (!started && typeof EventSource !== 'undefined') {
    started = true;
    // Live UI updates can arrive before an older installed app updates its server.
    fetch('/api/events').then(response => response.ok).catch(() => false).then(unified => {
      if (unified) {
        const source = new EventSource('/api/events/stream');
        sources.push(source);
        for (const name of ['live', 'pets', 'reload']) source.addEventListener(name, event => deliver(name, event));
      } else {
        for (const name of ['live', 'pets', 'reload']) {
          const source = new EventSource(`/api/${name}/stream`);
          sources.push(source);
          source.onmessage = event => deliver(name, event);
        }
      }
    });
  }
  return () => listeners.get(channel)?.delete(callback);
}

globalThis.addEventListener?.('pagehide', () => sources.forEach(source => source.close()));
