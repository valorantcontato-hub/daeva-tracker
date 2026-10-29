// Mesmas pedras e cores no catálogo, nos filtros e no radar.
export const PET_FAMILIES = {
  Cogni: { label: 'Intelectual', color: '#5aa5f0', stone: '/icons/pets/cogni.png' },
  Fera: { label: 'Feral', color: '#f0605a', stone: '/icons/pets/fera.png' },
  Natura: { label: 'Natural', color: '#4fd17a', stone: '/icons/pets/natura.png' },
  Varian: { label: 'Variante', color: '#4fd1d9', stone: '/icons/pets/varian.png' },
  Special: { label: 'Especial', color: '#e9b949', stone: '/icons/pets/special.png' },
};

export const petStone = (key, className = 'stone') => {
  const family = PET_FAMILIES[key];
  return family ? `<img class="${className}" src="${family.stone}" alt="${family.label}" draggable="false">` : '';
};

export function matchesPetStatus(progress, focused, status) {
  if (status === 'farming') return focused;
  if (status === 'missing') return progress.known && !progress.complete;
  if (status === 'complete') return progress.complete;
  return true;
}
