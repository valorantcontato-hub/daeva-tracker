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
