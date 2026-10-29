/** Só aceita posições identificadas pelo jogo e pertencentes ao personagem vinculado. */
export function verifiedRadarOwner(snapshot, profile) {
  const owner = snapshot?.selfProfile;
  const norm = name => String(name || '').normalize('NFKC').trim().toLowerCase();
  return snapshot?.selfVerified === true && Number(profile?.serverId) > 0
    && Number(owner?.serverId) === Number(profile.serverId)
    && !!norm(profile.name) && norm(owner?.name) === norm(profile.name);
}

export function readVerifiedRadar(value) {
  return value?.verifiedSelf === true && Number.isFinite(value.self?.x) && Number.isFinite(value.self?.y)
    && Array.isArray(value.mobs) ? value : null;
}

// No mapa do jogo, Y cresce para baixo. O ângulo normalizado da captura usa Y para cima.
// Espelha o mesmo eixo em posições e ângulos antes da rotação opcional do radar.
export const radarRotation = value => [0, 90, 180, 270].includes(value) ? value : 0;
export const radarHeading = (heading, rotation = 0) => ((180 - heading + radarRotation(rotation)) % 360 + 360) % 360;
export function radarOffset(dx, dy, rotation = 0) {
  const angle = radarRotation(rotation) * Math.PI / 180;
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
}

/** Mantém a orientação quando parado; usa ângulo explícito se a captura o fornecer. */
export function radarSelf(current, previous) {
  if (!current || !Number.isFinite(current.x) || !Number.isFinite(current.y)) return null;
  let heading = Number.isFinite(previous?.heading) ? previous.heading : 0;
  let headingSource = previous?.headingSource || 'unknown';
  if (Number.isFinite(current.heading)) {
    heading = current.heading;
    headingSource = current.headingSource || 'facing';
  } else if (previous) {
    const dx = current.x - previous.x, dy = current.y - previous.y;
    const distance = Math.hypot(dx, dy);
    // Não muda a seta por ruído nem por saltos de teleporte.
    if (distance >= 25 && distance < 25000) {
      heading = Math.atan2(dx, dy) * 180 / Math.PI;
      headingSource = 'movement';
    }
  }
  return { x: current.x, y: current.y, heading: (heading % 360 + 360) % 360, headingSource };
}
