/** Consolida o Farm antigo no Mini mapa, preservando as preferências existentes. */
export function migrateWidgets(cfg) {
  if (!cfg.farm) return cfg;
  if (cfg.farm.visible && !cfg.radar?.visible) {
    cfg.radar = { ...cfg.farm, bounds: null, ...cfg.radar, visible: true };
  }
  delete cfg.farm;
  return cfg;
}
