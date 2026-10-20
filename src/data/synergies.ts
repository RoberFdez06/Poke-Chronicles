// Objetos activos (una ranura aparte, se recargan limpiando salas) y sinergias entre objetos y poderes.
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { PlayerStats } from './items.ts';

// --- Objetos activos ---

export interface ActiveItem {
  id: string;
  name: string;
  description: string;
  /** Salas que hay que limpiar para recargarlo. */
  charge: number;
  color: number;
}

export const ACTIVE_ITEMS: readonly ActiveItem[] = [
  { id: 'poke-flauta', name: 'Poké Flauta', description: 'Aturde a todos los enemigos de la sala 2,5 s.', charge: 3, color: 0x7ab8f0 },
  { id: 'repelente', name: 'Repelente', description: 'Los enemigos huyen de ti durante 5 s.', charge: 2, color: 0xb070e0 },
  { id: 'pokeblock', name: 'Pokéblock', description: 'Recuperas 35 PS.', charge: 3, color: 0xf06090 },
  { id: 'ataque-x', name: 'Ataque X', description: 'Haces un 50 % más de daño durante 8 s.', charge: 2, color: 0xf07a3a },
  // T49
  { id: 'pocion-activa', name: 'Poción', description: 'Recuperas 40 PS.', charge: 2, color: 0x9b59d0 },
  { id: 'caramelo-raro', name: 'Caramelo Raro', description: 'Haces el doble de daño durante 5 s.', charge: 3, color: 0x4fc3f7 },
  { id: 'teletransporte', name: 'Teletransporte', description: 'Vuelves a la sala de inicio del piso.', charge: 2, color: 0xe1bee7 },
  { id: 'bomba-cebo', name: 'Bomba Cebo', description: 'Gran explosión a tu alrededor que no te hace daño.', charge: 3, color: 0xff7043 },
  { id: 'silbato', name: 'Silbato', description: 'Eres inmune a todo durante 2 s.', charge: 2, color: 0xfff176 },
];

export const ACTIVE_IDS = ACTIVE_ITEMS.map((a) => a.id);
export const activeById = (id: string): ActiveItem | undefined => ACTIVE_ITEMS.find((a) => a.id === id);

/** Probabilidad de que un objeto del suelo sea activo. */
export const ACTIVE_DROP_CHANCE = 0.15;

/** Efectos de los activos. */
export const ACTIVE_EFFECT = {
  stunMs: 2500,
  fearMs: 5000,
  heal: 35,
  buffMs: 8000,
  buffMul: 1.5,
  // T49
  potionHeal: 40,
  candyMs: 5000,
  candyMul: 2,
  /** Bomba Cebo: radio y daño respecto a una bomba normal. */
  baitRadiusMul: 1.6,
  baitDamageMul: 2,
  whistleMs: 2000,
} as const;

/** Carga tras limpiar una sala (sin pasar del máximo). */
export const chargeAfterClear = (charge: number, max: number): number => Math.min(max, charge + 1);
export const isCharged = (charge: number, max: number): boolean => charge >= max;

// --- Sinergias ---

export interface Synergy {
  id: string;
  name: string;
  description: string;
  /** Objetos que hay que tener todos. */
  all?: readonly string[];
  /** O bien al menos `count` de estos. */
  anyOf?: { ids: readonly string[]; count: number };
  /** Y un poder de este tipo en las ranuras. */
  powerType?: string;
  apply(s: PlayerStats): void;
}

const boostStatus = (s: PlayerStats, type: string, mul: number) => void (s.statusBoost[type] = (s.statusBoost[type] ?? 1) * mul);

export const SYNERGIES: readonly Synergy[] = [
  { id: 'fuego-interior', name: 'Fuego interior', description: 'Carbón + poder de Fuego: quemaduras el doble de fuertes.',
    all: ['carbon'], powerType: 'fire', apply: (s) => boostStatus(s, 'fire', 2) },
  { id: 'marea', name: 'Marea', description: 'Agua Mística + poder de Agua: empapar dura y frena el doble.',
    all: ['agua-mistica'], powerType: 'water', apply: (s) => boostStatus(s, 'water', 2) },
  { id: 'sobrecarga', name: 'Sobrecarga', description: 'Imán + poder Eléctrico: parálisis más larga.',
    all: ['iman'], powerType: 'electric', apply: (s) => boostStatus(s, 'electric', 1.8) },
  { id: 'ventisca', name: 'Ventisca', description: 'Hielo Eterno + poder de Hielo: congela más tiempo.',
    all: ['hielo-eterno'], powerType: 'ice', apply: (s) => boostStatus(s, 'ice', 1.6) },
  { id: 'toxico', name: 'Tóxico', description: 'Flecha Venenosa + poder de Veneno: veneno el doble de fuerte.',
    all: ['flecha-venenosa'], powerType: 'poison', apply: (s) => boostStatus(s, 'poison', 2) },
  { id: 'eleccion', name: 'Elección', description: 'Dos objetos "Elegido": +15 % de daño, poderes y velocidad.',
    anyOf: { ids: ['cinta-elegida', 'gafas-elegidas', 'panuelo-elegido'], count: 2 },
    apply: (s) => void ((s.damage *= 1.15), (s.powerMul *= 1.15), (s.speed *= 1.1)) },
  { id: 'francotirador', name: 'Francotirador', description: 'Lente Zoom + Periscopio: críticos mucho más fuertes.',
    all: ['lente-zoom', 'periscopio'], apply: (s) => void (s.critMul += 0.75) },
  { id: 'vampiro', name: 'Vampiro', description: 'Concha Campana + Restos: el doble de robo de vida.',
    all: ['concha-campana', 'restos'], apply: (s) => void (s.lifesteal *= 2) },
  { id: 'muralla', name: 'Muralla', description: 'Casco Dentado + Chaleco Asalto: el doble de daño a quien te toca.',
    all: ['casco-dentado', 'chaleco-asalto'], apply: (s) => void (s.thorns *= 2) },
  { id: 'buscador', name: 'Buscador', description: 'Telescopio + Lupa: tus disparos persiguen mucho mejor.',
    all: ['telescopio', 'lupa'], apply: (s) => void (s.homing += 2.5) },
  { id: 'tormenta', name: 'Tormenta', description: 'Doble Equipo + Cola Gemela: un disparo extra más.',
    all: ['doble-equipo', 'cola-gemela'], apply: (s) => void (s.extraShots += 1) },
];

export function synergyActive(syn: Synergy, passives: readonly string[], powerTypes: readonly string[]): boolean {
  const have = new Set(passives);
  if (syn.all && !syn.all.every((id) => have.has(id))) return false;
  if (syn.anyOf && syn.anyOf.ids.filter((id) => have.has(id)).length < syn.anyOf.count) return false;
  if (syn.powerType && !powerTypes.includes(syn.powerType)) return false;
  return true;
}

/** Aplica las sinergias activas sobre las estadísticas (ya con los objetos) y dice cuáles son. */
export function applySynergies(
  stats: PlayerStats,
  passives: readonly string[],
  powerTypes: readonly string[],
): { stats: PlayerStats; active: Synergy[] } {
  const s: PlayerStats = { ...stats, typeBoost: { ...stats.typeBoost }, statusBoost: { ...stats.statusBoost } };
  const active = SYNERGIES.filter((syn) => synergyActive(syn, passives, powerTypes));
  for (const syn of active) syn.apply(s);
  return { stats: s, active };
}
