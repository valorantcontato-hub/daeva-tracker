/** Consolida o Farm antigo no Mini mapa, preservando as preferências existentes. */
export function migrateWidgets(cfg) {
  if (cfg.farm?.visible && !cfg.radar?.visible) {
    cfg.radar = { ...cfg.farm, bounds: null, ...cfg.radar, visible: true };
  }
  delete cfg.farm;
  for (const id of ['party', 'skills', 'radar']) if (cfg[id]) delete cfg[id].corner;
  return cfg;
}

export function widgetScale(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(.75, Math.min(1.5, Math.round(value * 20) / 20)) : 1;
}

/** Fixed dimensions from the panel; saved bounds preserve only the drag position. */
export function widgetBounds(id, size, saved, area, scale = 1) {
  const margin = 16;
  const width = Math.min(Math.round(size.width * widgetScale(scale)), area.width - margin * 2);
  const height = Math.min(Math.round(size.height * widgetScale(scale)), area.height - margin * 2);
  const left = area.x + margin, top = area.y + margin;
  const right = area.x + area.width - width - margin, bottom = area.y + area.height - height - margin;
  return { width, height,
    x: Math.max(left, Math.min(Number.isFinite(saved?.x) ? saved.x : id === 'radar' ? right : left, right)),
    y: Math.max(top, Math.min(Number.isFinite(saved?.y) ? saved.y : id === 'party' ? top : bottom, bottom)),
  };
}

/** Locked widgets step aside under the pointer; unlocking always restores them. */
export function widgetPointerOpacity(locked, bounds, pointer) {
  return locked && pointer.x >= bounds.x && pointer.x < bounds.x + bounds.width
    && pointer.y >= bounds.y && pointer.y < bounds.y + bounds.height ? 0 : 1;
}
