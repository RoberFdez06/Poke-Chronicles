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
  { id: 'caramelo-raro-activo', name: 'Caramelo Raro', description: 'Haces el doble de daño durante 5 s.', charge: 3, color: 0x4fc3f7 },
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
  /** Efectos nuevos que no son números (orbitales, rastros, cadenas…), ver synergyFx.ts. */
  fx?: readonly SynergyFx[];
  /** Transformación (3 piezas, muy rara): cambia el aspecto del jugador. */
  transform?: { color: number; glow: number };
}

/** Efectos especiales de las sinergias: GameScene los hace de verdad (scenes/synergyRuntime.ts). */
export type SynergyFx =
  /** Esferas que giran a tu alrededor, dañan al tocar y paran disparos enemigos. */
  | { kind: 'orbitals'; count: number; radius: number; dmg: number; color: number }
  /** Rastro al moverte que daña (fuego quema, hielo congela). */
  | { kind: 'trail'; element: 'fire' | 'ice'; dmg: number }
  /** Al golpear, un rayo salta a otros enemigos cercanos. */
  | { kind: 'chain'; chance: number; jumps: number; range: number; mul: number }
  /** Cada enemigo derrotado te cura. */
  | { kind: 'healOnKill'; hp: number }
  /** Cada disparo se repite un instante después (eco). */
  | { kind: 'echo'; delay: number; mul: number }
  /** Aura que daña a quien está cerca. */
  | { kind: 'aura'; radius: number; dps: number; color: number }
  /** Probabilidad de devolver los disparos enemigos que te tocan. */
  | { kind: 'reflect'; chance: number }
  /** Probabilidad de botín extra al derrotar. */
  | { kind: 'extraDrop'; chance: number }
  /** Tus disparos estallan en cada impacto. */
  | { kind: 'burst'; radius: number; mul: number }
  /** Tus disparos se parten en varios al impactar. */
  | { kind: 'split'; count: number; mul: number }
  /** Tus disparos rebotan hacia otro enemigo al impactar. */
  | { kind: 'ricochet'; times: number }
  /** Cada poco sueltas un anillo de disparos. */
  | { kind: 'nova'; every: number; count: number; mul: number }
  /** Al recibir daño, onda que empuja y daña. */
  | { kind: 'retaliate'; radius: number; dmg: number };

const boostStatus = (s: PlayerStats, type: string, mul: number) => void (s.statusBoost[type] = (s.statusBoost[type] ?? 1) * mul);

const BASIC_SYNERGIES: readonly Synergy[] = [
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
  // T52
  { id: 'especialista', name: 'Especialista', description: 'Cinta Experto + Gafas Especiales: poderes un 25 % más fuertes.',
    all: ['cinta-experto', 'gafas-especiales'], apply: (s) => void (s.powerMul *= 1.25) },
  { id: 'golpe-real', name: 'Golpe real', description: 'Roca del Rey + Garra Afilada: +10 % de crítico.',
    all: ['roca-del-rey', 'garra-afilada'], apply: (s) => void (s.critChance = Math.min(1, s.critChance + 0.1)) },
  { id: 'relampago', name: 'Relámpago', description: 'Polvo Veloz + Pañuelo Elegido: disparas un 15 % más rápido.',
    all: ['polvo-veloz', 'panuelo-elegido'], apply: (s) => void (s.fireDelay *= 0.85) },
  { id: 'luz-de-luna', name: 'Luz de luna', description: 'Piedra Lunar + Bola Luminosa: atraviesan un enemigo más y persiguen mejor.',
    all: ['piedra-lunar', 'bola-luminosa'], apply: (s) => void ((s.pierce += 1), (s.homing += 1)) },
  { id: 'erizo', name: 'Erizo', description: 'Púa Tóxica + Casco Dentado: +50 % de daño a quien te toca y veneno más fuerte.',
    all: ['pua-toxica', 'casco-dentado'], apply: (s) => void ((s.thorns *= 1.5), boostStatus(s, 'poison', 1.5)) },
  { id: 'superviviente', name: 'Superviviente', description: 'Mineral Evolutivo + Hierba Mental: un 15 % menos de daño y otro escudo.',
    all: ['mineral-evolutivo', 'hierba-mental'], apply: (s) => void ((s.damageTaken *= 0.85), (s.shieldPerRoom += 1)) },
];

const nothing = () => undefined;

/**
 * Sinergias que transforman (T-sinergias): cada una con un efecto nuevo y visible, no solo números.
 * Recetas de dos piezas (objetos y, alguna, un poder del tipo).
 */
export const COMBO_SYNERGIES: readonly Synergy[] = [
  { id: 'rebote-eterno', name: 'Rebote Eterno', description: 'Pelota Saltarina + Bola Luminosa: al impactar, tu disparo salta hacia otro enemigo (2 veces).',
    all: ['pelota-saltarina', 'bola-luminosa'], apply: nothing, fx: [{ kind: 'ricochet', times: 2 }] },
  { id: 'pirotecnia', name: 'Pirotecnia', description: 'Piedra Dura + Bola Férrea: tus disparos estallan en cada enemigo que atraviesan.',
    all: ['piedra-dura', 'bola-ferrea'], apply: nothing, fx: [{ kind: 'burst', radius: 60, mul: 0.45 }] },
  { id: 'danza-lunar', name: 'Danza Lunar', description: 'Piedra Lunar + Polvo Brillo: dos lunas giran a tu alrededor, dañan y paran disparos.',
    all: ['piedra-lunar', 'polvo-brillo'], apply: nothing, fx: [{ kind: 'orbitals', count: 2, radius: 62, dmg: 9, color: 0xcfd8ff }] },
  { id: 'rueda-fuego', name: 'Rueda Fuego', description: 'Carbón + Pluma Ligera: dejas un rastro de fuego que quema al pisarlo.',
    all: ['carbon', 'pluma-ligera'], apply: nothing, fx: [{ kind: 'trail', element: 'fire', dmg: 6 }] },
  { id: 'pista-helada', name: 'Pista Helada', description: 'Hielo Eterno + Polvo Veloz: dejas un rastro de hielo que congela.',
    all: ['hielo-eterno', 'polvo-veloz'], apply: nothing, fx: [{ kind: 'trail', element: 'ice', dmg: 4 }] },
  { id: 'rayo-cadena', name: 'Rayo en Cadena', description: 'Imán + Lupa Doble: a veces, un rayo salta del golpe a 3 enemigos cercanos.',
    all: ['iman', 'lupa-doble'], apply: nothing, fx: [{ kind: 'chain', chance: 0.3, jumps: 3, range: 220, mul: 0.6 }] },
  { id: 'gigadrenado', name: 'Gigadrenado', description: 'Semilla Milagro + poder de Planta: cada enemigo derrotado te cura 3 PS.',
    all: ['semilla-milagro'], powerType: 'grass', apply: nothing, fx: [{ kind: 'healOnKill', hp: 3 }] },
  { id: 'eco-psiquico', name: 'Eco Psíquico', description: 'Cuchara Torcida + Reloj de Arena: cada disparo se repite como un eco más débil.',
    all: ['cuchara-torcida', 'reloj-arena'], apply: nothing, fx: [{ kind: 'echo', delay: 170, mul: 0.5 }] },
  { id: 'aura-esfera', name: 'Aura Esfera', description: 'Cinturón Negro + Piedra Escudo: un aura de lucha daña a los que se acercan.',
    all: ['cinturon-negro', 'piedra-escudo'], apply: nothing, fx: [{ kind: 'aura', radius: 95, dps: 14, color: 0x6ab0ff }] },
  { id: 'capa-magica', name: 'Capa Mágica', description: 'Gafas Protectoras + Hechizo: un 30 % de los disparos enemigos que te tocan rebotan contra ellos.',
    all: ['gafas-protectoras', 'hechizo'], apply: nothing, fx: [{ kind: 'reflect', chance: 0.3 }] },
  { id: 'dia-de-pago', name: 'Día de Pago', description: 'Moneda Amuleto + Zahorí: un 25 % de botín extra al derrotar enemigos.',
    all: ['moneda-amuleto', 'zahori'], apply: nothing, fx: [{ kind: 'extraDrop', chance: 0.25 }] },
  { id: 'bala-semilla', name: 'Bala Semilla', description: 'Púa Tóxica + Doble Equipo: tus disparos se parten en 3 semillas al impactar.',
    all: ['pua-toxica', 'doble-equipo'], apply: nothing, fx: [{ kind: 'split', count: 3, mul: 0.4 }] },
  { id: 'furia-dragon', name: 'Furia Dragón', description: 'Colmillo Dragón + poder de Dragón: cada 3 s sueltas un anillo de 8 llamas dragón.',
    all: ['colmillo-dragon'], powerType: 'dragon', apply: nothing, fx: [{ kind: 'nova', every: 3000, count: 8, mul: 0.7 }] },
  { id: 'represalia', name: 'Represalia', description: 'Banda Focus + Chaleco Asalto: al recibir daño sueltas una onda que golpea a todos cerca.',
    all: ['banda-focus', 'chaleco-asalto'], apply: nothing, fx: [{ kind: 'retaliate', radius: 170, dmg: 40 }] },
];

/** Transformaciones: tres piezas, muy raras y potentes, con aspecto propio en el jugador. */
export const TRANSFORMATIONS: readonly Synergy[] = [
  { id: 'fuego-sagrado', name: 'Fuego Sagrado', description: 'Carbón + Concha Campana + Orbe Vital: te envuelven llamas sagradas que queman, dejas fuego al andar y cada baja cura.',
    all: ['carbon', 'concha-campana', 'orbe-vital'], transform: { color: 0xff7a2a, glow: 0xffe066 },
    apply: (s) => void ((s.damage *= 1.15), boostStatus(s, 'fire', 1.5)),
    fx: [{ kind: 'aura', radius: 115, dps: 22, color: 0xff8a3a }, { kind: 'trail', element: 'fire', dmg: 8 }, { kind: 'healOnKill', hp: 2 }] },
  { id: 'tormenta-eterna', name: 'Tormenta Eterna', description: 'Imán + Telescopio + Doble Equipo: cada golpe encadena rayos y tres chispas te orbitan.',
    all: ['iman', 'telescopio', 'doble-equipo'], transform: { color: 0xffe14a, glow: 0x9ad7ff },
    apply: (s) => void ((s.fireDelay *= 0.9), boostStatus(s, 'electric', 1.5)),
    fx: [{ kind: 'chain', chance: 1, jumps: 3, range: 240, mul: 0.5 }, { kind: 'orbitals', count: 3, radius: 70, dmg: 12, color: 0xffe14a }] },
  { id: 'velo-espectral', name: 'Velo Espectral', description: 'Hechizo + Polvo Brillo + Cuerda Huida: medio fantasma; esquivas más, devuelves disparos y cuatro almas te rodean.',
    all: ['hechizo', 'polvo-brillo', 'cuerda-huida'], transform: { color: 0x9a6ad8, glow: 0xe0c8ff },
    apply: (s) => void ((s.dodge = Math.min(0.6, s.dodge + 0.12)), (s.speed *= 1.08)),
    fx: [{ kind: 'reflect', chance: 0.45 }, { kind: 'orbitals', count: 4, radius: 78, dmg: 10, color: 0xb28ae8 }] },
];

export const SYNERGIES: readonly Synergy[] = [...BASIC_SYNERGIES, ...COMBO_SYNERGIES, ...TRANSFORMATIONS];

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
