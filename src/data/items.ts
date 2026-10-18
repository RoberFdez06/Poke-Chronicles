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

/**
 * Estadísticas resultantes de tener estos objetos (se repiten si hay duplicados), encima de las del
 * Pokémon (`base`, ver pokeStats.ts) o de las de por defecto.
 */
export function computeStats(passiveIds: readonly string[], base: Readonly<PlayerStats> = BASE_STATS): PlayerStats {
  const s: PlayerStats = { ...base };
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

export type DroppedItem = { kind: 'passive'; item: PassiveItem } | { kind: 'move'; move: MovePower };

/** Probabilidad de que un objeto sea un poder (movimiento) en lugar de un pasivo. */
export const MOVE_ITEM_CHANCE = 0.5;

/**
 * Elige qué aparece en el suelo. Un poder se saca (y se quita) de `movePool`;
 * los pasivos evitan repetirse hasta que se tienen todos.
 */
export function rollItem(rng: () => number, ownedPassives: ReadonlySet<string>, movePool: MovePower[]): DroppedItem {
  if (movePool.length > 0 && rng() < MOVE_ITEM_CHANCE) {
    const [move] = movePool.splice(Math.floor(rng() * movePool.length), 1);
    return { kind: 'move', move };
  }
  const fresh = PASSIVE_ITEMS.filter((i) => !ownedPassives.has(i.id));
  const list = fresh.length > 0 ? fresh : PASSIVE_ITEMS;
  return { kind: 'passive', item: list[Math.floor(rng() * list.length)] };
}
