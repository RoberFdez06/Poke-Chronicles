// Estadísticas del jugador, objetos pasivos y poderes (movimientos): lógica pura, sin Phaser ni red.

export interface PlayerStats {
  /** Daño por disparo. */
  damage: number;
  /** Milisegundos entre disparos. */
  fireDelay: number;
  /** Velocidad del disparo en px/s. */
  shotSpeed: number;
  /** Milisegundos que dura un disparo en el aire. */
  range: number;
  /** Velocidad del jugador en px/s. */
  speed: number;
  maxHp: number;
  /** Disparos extra en abanico. */
  extraShots: number;
  /** Enemigos que atraviesa cada disparo. */
  pierce: number;
  /** Rebotes en las paredes. */
  bounces: number;
  /** PS que recuperas al limpiar una sala. */
  healOnClear: number;
  /** Multiplicador del daño de los poderes (sale del Ataque Especial del Pokémon). */
  powerMul: number;
  /** Multiplicador del daño que recibes (sale de la Defensa y la Defensa Especial). */
  damageTaken: number;
  // --- Efectos especiales de los objetos (T23) ---
  /** Probabilidad (0-1) de golpe crítico y cuánto multiplica. */
  critChance: number;
  critMul: number;
  /** Fracción del daño hecho que recuperas como PS. */
  lifesteal: number;
  /** Daño que recibe quien te toca. */
  thorns: number;
  /** Probabilidad (0-1) de esquivar un golpe. */
  dodge: number;
  /** Golpes que para el escudo en cada sala. */
  shieldPerRoom: number;
  /** Veces por piso que aguantas con 1 PS un golpe que te dejaría a 0. */
  focusBand: number;
  /** PS que recuperas una vez por piso al bajar del 25 % de vida (0 = no). */
  lowHpHeal: number;
  /** Cuánto giran tus disparos hacia el enemigo más cercano (radianes por segundo). */
  homing: number;
  /** Disparos extra hacia atrás. */
  backShots: number;
  /** Alcance extra por cada enemigo vivo en la sala (fracción). */
  rangePerEnemy: number;
  /** Multiplicador de las monedas que recoges. */
  coinMul: number;
  /** Tamaño de tus disparos. */
  shotScale: number;
  /** Daño extra de los poderes de un tipo (fracción), p. ej. { fire: 0.25 }. */
  typeBoost: Partial<Record<string, number>>;
  /** Fuerza de los estados que aplican tus poderes de un tipo (1 = normal; lo suben las sinergias). */
  statusBoost: Partial<Record<string, number>>;
}

export const BASE_STATS: Readonly<PlayerStats> = {
  damage: 9,
  fireDelay: 340,
  shotSpeed: 520,
  range: 750,
  speed: 240,
  maxHp: 100,
  extraShots: 0,
  pierce: 0,
  bounces: 0,
  healOnClear: 0,
  powerMul: 1,
  damageTaken: 1,
  critChance: 0,
  critMul: 2,
  lifesteal: 0,
  thorns: 0,
  dodge: 0,
  shieldPerRoom: 0,
  focusBand: 0,
  lowHpHeal: 0,
  homing: 0,
  backShots: 0,
  rangePerEnemy: 0,
  coinMul: 1,
  shotScale: 1,
  typeBoost: {},
  statusBoost: {},
};

export const MIN_FIRE_DELAY = 90;

export interface PassiveItem {
  id: string;
  name: string;
  description: string;
  color: number;
  apply(stats: PlayerStats): void;
}

/** Objetos propios: mejoras numéricas que se acumulan. Los nombres son provisionales. */
export const PASSIVE_ITEMS: readonly PassiveItem[] = [
  {
    id: 'baya-aranja',
    name: 'Baya Aranja',
    description: '+20 PS máximos y los recuperas.',
    color: 0xff9f43,
    apply: (s) => void (s.maxHp += 20),
  },
  {
    id: 'vidasfera',
    name: 'Vidasfera',
    description: '+30 % de daño.',
    color: 0xd63031,
    apply: (s) => void (s.damage *= 1.3),
  },
  {
    id: 'garra-rapida',
    name: 'Garra Rápida',
    description: 'Disparas un 20 % más rápido.',
    color: 0xfdcb6e,
    apply: (s) => void (s.fireDelay *= 0.8),
  },
  {
    id: 'lupa',
    name: 'Lupa',
    description: 'Tus disparos llegan más lejos.',
    color: 0x74b9ff,
    apply: (s) => void (s.range *= 1.4),
  },
  {
    id: 'pluma-ligera',
    name: 'Pluma Ligera',
    description: 'Te mueves un 12 % más rápido.',
    color: 0xdfe6e9,
    apply: (s) => void (s.speed *= 1.12),
  },
  {
    id: 'doble-equipo',
    name: 'Doble Equipo',
    description: 'Un proyectil extra en abanico.',
    color: 0xa29bfe,
    apply: (s) => void (s.extraShots += 1),
  },
  {
    id: 'piedra-dura',
    name: 'Piedra Dura',
    description: 'Tus disparos atraviesan un enemigo.',
    color: 0x95a5a6,
    apply: (s) => void (s.pierce += 1),
  },
  {
    id: 'pelota-saltarina',
    name: 'Pelota Saltarina',
    description: 'Tus disparos rebotan una vez en las paredes.',
    color: 0x55efc4,
    apply: (s) => void (s.bounces += 1),
  },
  {
    id: 'restos',
    name: 'Restos',
    description: 'Recuperas 10 PS al limpiar una sala.',
    color: 0x00b894,
    apply: (s) => void (s.healOnClear += 10),
  },
];

export function passiveById(id: string): PassiveItem | undefined {
  return PASSIVE_ITEMS.find((i) => i.id === id);
}

/** Nombres de tipo en español (copia mínima para no depender de types.ts en las descripciones). */
const TYPE_ES: Record<string, string> = {
  fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo', fighting: 'Lucha',
  psychic: 'Psíquico', dragon: 'Dragón', ghost: 'Fantasma', dark: 'Siniestro', steel: 'Acero', normal: 'Normal',
  flying: 'Volador', bug: 'Bicho', poison: 'Veneno', ground: 'Tierra',
};

/** Potenciadores de tipo (como los objetos de los juegos): +25 % de daño a los poderes de su tipo. */
const TYPE_BOOSTERS: [string, string, string, number][] = [
  ['carbon', 'Carbón', 'fire', 0x3d3d3d],
  ['agua-mistica', 'Agua Mística', 'water', 0x3d8fd6],
  ['iman', 'Imán', 'electric', 0xd0a020],
  ['semilla-milagro', 'Semilla Milagro', 'grass', 0x5aa83a],
  ['hielo-eterno', 'Hielo Eterno', 'ice', 0x8fd8e8],
  ['cinturon-negro', 'Cinturón Negro', 'fighting', 0x2b2b2b],
  ['cuchara-torcida', 'Cuchara Torcida', 'psychic', 0xe060a0],
  ['colmillo-dragon', 'Colmillo Dragón', 'dragon', 0x6f35fc],
  ['hechizo', 'Hechizo', 'ghost', 0x735797],
  ['gafas-de-sol', 'Gafas de Sol', 'dark', 0x40342c],
  ['revestimiento-metalico', 'Revestimiento Metálico', 'steel', 0xa8a8c0],
  ['seda-fina', 'Seda Fina', 'normal', 0xe8e0c8],
  ['pico-afilado', 'Pico Afilado', 'flying', 0xa98ff3],
  ['polvo-plata', 'Polvo Plata', 'bug', 0xc0c8a0],
  ['flecha-venenosa', 'Flecha Venenosa', 'poison', 0xa33ea1],
  ['arena-fina', 'Arena Fina', 'ground', 0xe2bf65],
];

const add = (map: Partial<Record<string, number>>, k: string, v: number) => void (map[k] = (map[k] ?? 0) + v);

/** Objetos nuevos (T23): con efectos que no son solo números. */
const SPECIAL_ITEMS: PassiveItem[] = [
  { id: 'cinta-elegida', name: 'Cinta Elegida', description: '+50 % de daño, pero disparas un poco más lento.', color: 0xe84a4a,
    apply: (s) => void ((s.damage *= 1.5), (s.fireDelay *= 1.15)) },
  { id: 'gafas-elegidas', name: 'Gafas Elegidas', description: 'Tus poderes hacen un 40 % más de daño.', color: 0x4a7ae8,
    apply: (s) => void (s.powerMul *= 1.4) },
  { id: 'panuelo-elegido', name: 'Pañuelo Elegido', description: 'Vas un 25 % más rápido y disparas algo antes.', color: 0x4ac86a,
    apply: (s) => void ((s.speed *= 1.25), (s.fireDelay *= 0.9)) },
  { id: 'lente-zoom', name: 'Lente Zoom', description: 'Más alcance y un 10 % de golpes críticos.', color: 0x8ab4e8,
    apply: (s) => void ((s.range *= 1.3), (s.critChance += 0.1)) },
  { id: 'periscopio', name: 'Periscopio', description: '+15 % de probabilidad de crítico.', color: 0x9ab0c0,
    apply: (s) => void (s.critChance += 0.15) },
  { id: 'garra-afilada', name: 'Garra Afilada', description: 'Críticos más probables y más fuertes.', color: 0xd8d8e8,
    apply: (s) => void ((s.critChance += 0.08), (s.critMul += 0.5)) },
  { id: 'banda-focus', name: 'Banda Focus', description: 'Una vez por piso aguantas con 1 PS un golpe mortal.', color: 0xff7a3a,
    apply: (s) => void (s.focusBand += 1) },
  { id: 'hierba-blanca', name: 'Hierba Blanca', description: 'Al bajar del 25 % de vida recuperas 30 PS (una vez por piso).', color: 0xf0f0e0,
    apply: (s) => void (s.lowHpHeal += 30) },
  { id: 'concha-campana', name: 'Concha Campana', description: 'Recuperas PS con el 8 % del daño que haces.', color: 0xf0c8a0,
    apply: (s) => void (s.lifesteal += 0.08) },
  { id: 'casco-dentado', name: 'Casco Dentado', description: 'Quien te toca recibe 30 de daño.', color: 0x8a6a4a,
    apply: (s) => void (s.thorns += 30) },
  { id: 'polvo-brillo', name: 'Polvo Brillo', description: 'Un 12 % de esquivar los golpes.', color: 0xfff8c0,
    apply: (s) => void (s.dodge = Math.min(0.5, s.dodge + 0.12)) },
  { id: 'gafas-protectoras', name: 'Gafas Protectoras', description: 'Un escudo para el primer golpe de cada sala.', color: 0x6ad0f0,
    apply: (s) => void (s.shieldPerRoom += 1) },
  { id: 'chaleco-asalto', name: 'Chaleco Asalto', description: 'Recibes un 20 % menos de daño.', color: 0x6a8a4a,
    apply: (s) => void (s.damageTaken *= 0.8) },
  { id: 'telescopio', name: 'Telescopio', description: 'Tus disparos siguen al enemigo más cercano.', color: 0xc0a0f0,
    apply: (s) => void (s.homing += 2.5) },
  { id: 'cola-gemela', name: 'Cola Gemela', description: 'También disparas hacia atrás.', color: 0xf0a0c8,
    apply: (s) => void (s.backShots += 1) },
  { id: 'pokeradar', name: 'Pokéradar', description: '+8 % de alcance por cada enemigo vivo en la sala.', color: 0x60d0a0,
    apply: (s) => void (s.rangePerEnemy += 0.08) },
  { id: 'moneda-amuleto', name: 'Moneda Amuleto', description: 'Las monedas valen el doble.', color: 0xffd34d,
    apply: (s) => void (s.coinMul *= 2) },
  { id: 'bola-ferrea', name: 'Bola Férrea', description: 'Disparos más grandes y un 25 % más fuertes, pero vas más lento.', color: 0x606878,
    apply: (s) => void ((s.shotScale *= 1.5), (s.damage *= 1.25), (s.speed *= 0.9)) },
  ...TYPE_BOOSTERS.map(([id, name, type, color]) => ({
    id,
    name,
    description: `Tus poderes de tipo ${TYPE_ES[type]} hacen un 25 % más de daño.`,
    color,
    apply: (st: PlayerStats) => add(st.typeBoost, type, 0.25),
  })),
];

(PASSIVE_ITEMS as PassiveItem[]).push(...SPECIAL_ITEMS);

/**
 * Estadísticas resultantes de tener estos objetos (se repiten si hay duplicados), encima de las del
 * Pokémon (`base`, ver pokeStats.ts) o de las de por defecto.
 */
export function computeStats(passiveIds: readonly string[], base: Readonly<PlayerStats> = BASE_STATS): PlayerStats {
  // Copia también los mapas por tipo, para no tocar los de la base
  const s: PlayerStats = { ...base, typeBoost: { ...base.typeBoost }, statusBoost: { ...base.statusBoost } };
  for (const id of passiveIds) passiveById(id)?.apply(s);
  s.fireDelay = Math.max(MIN_FIRE_DELAY, s.fireDelay);
  return s;
}

// --- Poderes: movimientos de PokeAPI que se usan con una tecla ---

export type MoveShape = 'bolt' | 'fan' | 'ring' | 'big';

export interface MoveInfo {
  id: number;
  name: string;
  type: string;
  power: number;
}

export interface MovePower extends MoveInfo {
  shape: MoveShape;
  /** Milisegundos de recarga. */
  cooldown: number;
}

/** La potencia del movimiento decide cómo sale: más potencia, más lento y más contundente. */
export function shapeForPower(power: number): MoveShape {
  if (power >= 100) return 'big'; // proyectil grande que atraviesa
  if (power >= 70) return 'fan'; // abanico de 3
  if (power >= 50) return 'ring'; // anillo de 8
  return 'bolt'; // disparo rápido
}

export function cooldownForPower(power: number): number {
  return Math.min(4000, 600 + power * 8);
}

export function toMovePower(m: MoveInfo): MovePower {
  return { ...m, shape: shapeForPower(m.power), cooldown: cooldownForPower(m.power) };
}

// --- Objetos que aparecen en el suelo ---

export type DroppedItem =
  | { kind: 'passive'; item: PassiveItem }
  | { kind: 'move'; move: MovePower }
  | { kind: 'active'; id: string };

/** Probabilidad de que un objeto sea un poder (movimiento) en lugar de un pasivo. */
export const MOVE_ITEM_CHANCE = 0.5;

/**
 * Elige qué aparece en el suelo. Un poder se saca (y se quita) de `movePool`;
 * los pasivos evitan repetirse hasta que se tienen todos.
 */
export function rollItem(
  rng: () => number,
  ownedPassives: ReadonlySet<string>,
  movePool: MovePower[],
  /** Probabilidad de un objeto activo (ids en `actives`); 0 = nunca. */
  activeChance = 0,
  actives: readonly string[] = [],
): DroppedItem {
  if (actives.length > 0 && rng() < activeChance) return { kind: 'active', id: actives[Math.floor(rng() * actives.length)] };
  if (movePool.length > 0 && rng() < MOVE_ITEM_CHANCE) {
    const [move] = movePool.splice(Math.floor(rng() * movePool.length), 1);
    return { kind: 'move', move };
  }
  const fresh = PASSIVE_ITEMS.filter((i) => !ownedPassives.has(i.id));
  const list = fresh.length > 0 ? fresh : PASSIVE_ITEMS;
  return { kind: 'passive', item: list[Math.floor(rng() * list.length)] };
}
