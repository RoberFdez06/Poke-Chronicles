export const TYPE_COLORS: Record<string, number> = {
  normal: 0xa8a77a, fire: 0xee8130, water: 0x6390f0, electric: 0xf7d02c,
  grass: 0x7ac74c, ice: 0x96d9d6, fighting: 0xc22e28, poison: 0xa33ea1,
  ground: 0xe2bf65, flying: 0xa98ff3, psychic: 0xf95587, bug: 0xa6b91a,
  rock: 0xb6a136, ghost: 0x735797, dragon: 0x6f35fc, dark: 0x705746,
  steel: 0xb7b7ce, fairy: 0xd685ad,
};

export const TYPE_NAMES_ES: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada',
};

export const typeNameEs = (t: string): string => TYPE_NAMES_ES[t] ?? t;

export const typeColor = (t: string): number => TYPE_COLORS[t] ?? 0xffffff;
export const typeHex = (t: string): string =>
  '#' + typeColor(t).toString(16).padStart(6, '0');
