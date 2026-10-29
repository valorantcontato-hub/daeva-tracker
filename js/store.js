// Persistência local. Tudo fica no navegador do usuário (localStorage).
const PREFIX = 'a2t:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Avisa a própria janela que dados mudaram (o evento "storage" só chega nas outras). */
export const notifyChange = () => dispatchEvent(new Event('a2t:changed'));

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
