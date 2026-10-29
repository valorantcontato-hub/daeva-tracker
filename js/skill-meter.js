/** Packet IDs can vary by level, hit component or DoT while naming one skill. */
export function groupSkillVariants(skills, labelFor = skill => skill.name) {
  const groups = new Map();
  for (const skill of skills) {
    const name = String(labelFor(skill) || skill.name || '#' + skill.id);
    const key = name.normalize('NFKC').trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { ...skill, name, damage: 0, hits: 0, crits: 0, max: 0 });
    const row = groups.get(key);
    for (const field of ['damage', 'hits', 'crits']) row[field] += Number(skill[field]) || 0;
    row.max = Math.max(row.max, Number(skill.max) || 0);
    row.icon ||= skill.icon;
  }
  return [...groups.values()].sort((a, b) => b.damage - a.damage);
}
