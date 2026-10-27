// T56: Salas con reglas especiales. Algunas salas de combate traen una regla que cambia la pelea:
// - Un solo tipo: solo un tipo de daño (uno de los tuyos) pega entero; el resto de ataques hacen la mitad.
// - Se multiplican: al caer un enemigo, 25 % de que salga uno pequeño (los pequeños ya no se multiplican).
// - A oscuras: solo ves alrededor de tu Pokémon.
// - Velocidad: los enemigos van más rápido, pero al limpiarla cae botín extra.
// Salen de la semilla del piso (iguales al continuar y en el desafío diario) y nunca en la sala del jefe, la tienda, la
// inicial ni en las que ya tienen algo propio (evento, minijefe, desafío…): solo en salas de combate normales.
// Lógica pura, sin Phaser.
import type { Floor } from './floorGen.ts';
import type { LootDrop } from '../data/loot.ts';

export const ROOM_RULES = ['oneType', 'multiply', 'dark', 'speed'] as const;
export type RoomRule = (typeof ROOM_RULES)[number];

export const ROOM_RULE_LABEL: Record<RoomRule, string> = {
  oneType: 'Sala de un solo tipo',
  multiply: 'Sala de la plaga',
  dark: 'Sala a oscuras',
  speed: 'Sala de velocidad',
};

/** Color de su marca en el minimapa (rombo), distinto de los eventos y del minijefe. */
export const ROOM_RULE_COLOR: Record<RoomRule, number> = {
  oneType: 0x26c6da,
  multiply: 0x9ccc65,
  dark: 0x5c6bc0,
  speed: 0xffee58,
};

/** Aviso al entrar (el del tipo lleva su nombre: ver ruleNotice). */
export const ROOM_RULE_DESC: Record<RoomRule, string> = {
  oneType: 'Solo pega entero un tipo; el resto de ataques, la mitad',
  multiply: 'Al caer un enemigo puede salir otro pequeño',
  dark: 'Solo ves alrededor de tu Pokémon',
  speed: 'Enemigos más rápidos, pero mejor botín',
};

/** Probabilidad de que una sala de combate tenga regla: nada en el piso 1 y sube con la profundidad hasta un tope. */
export function ruleChance(floorNum: number): number {
  if (floorNum <= 1) return 0;
  return Math.min(0.3, 0.08 + 0.04 * (floorNum - 2));
}

/**
 * Reglas del piso: sala → regla. Solo salas de combate fuera de `exclude`. Cada sala hace siempre dos tiradas de
 * `rng` (en orden de id), así el resto del azar del piso no depende de cuántas salas tengan regla.
 */
export function pickRoomRules(floor: Floor, floorNum: number, rng: () => number, exclude: ReadonlySet<number> = new Set()): Map<number, RoomRule> {
  const out = new Map<number, RoomRule>();
  const chance = ruleChance(floorNum);
  for (const r of [...floor.rooms].sort((a, b) => a.id - b.id)) {
    const roll = rng();
    const which = rng();
    if (r.kind !== 'combat' || exclude.has(r.id) || roll >= chance) continue;
    out.set(r.id, ROOM_RULES[Math.min(ROOM_RULES.length - 1, Math.floor(which * ROOM_RULES.length))]);
  }
  return out;
}

// --- Un solo tipo ---

/**
 * Tipo que pega entero en la sala: siempre uno de los del jugador (sus ataques son de sus tipos; si fuera otro, todo
 * haría la mitad y la sala sería solo un castigo). Fijo por sala para que no cambie al salir y volver.
 */
export const oneTypeFor = (playerTypes: readonly string[], roomId: number): string =>
  playerTypes.length > 0 ? playerTypes[roomId % playerTypes.length] : 'normal';

/** Lo que hacen los demás tipos en la sala de un solo tipo. */
export const ONE_TYPE_OFF_MUL = 0.5;
/** Multiplicador de un ataque de `attackType` en una sala con esta regla (sin tipo cuenta como Normal). */
export function ruleDamageMul(rule: RoomRule | undefined, attackType: string | undefined, allowed: string): number {
  if (rule !== 'oneType') return 1;
  return (attackType ?? 'normal') === allowed ? 1 : ONE_TYPE_OFF_MUL;
}

/** Aviso al entrar en la sala. */
export const ruleNotice = (rule: RoomRule, typeName?: string): string =>
  rule === 'oneType' && typeName ? `${ROOM_RULE_LABEL[rule]}: ${typeName}\nEl resto de ataques hacen la mitad` : `${ROOM_RULE_LABEL[rule]}\n${ROOM_RULE_DESC[rule]}`;

// --- Se multiplican ---

export const MULTIPLY_CHANCE = 0.25;
/** Tamaño y vida del pequeño respecto al normal. */
export const MULTIPLY_SIZE = 0.65;
export const MULTIPLY_HP = 0.4;
/** ¿Sale uno pequeño? Los jefes, minijefes, ayudantes y los que ya son pequeños no se multiplican (si no, no acabaría). */
export const shouldMultiply = (rule: RoomRule | undefined, special: boolean, rng: () => number): boolean =>
  rule === 'multiply' && !special && rng() < MULTIPLY_CHANCE;

// --- A oscuras ---

/** Radio que se ve alrededor del jugador (px del mundo). Con efectos bajos, el borde es duro y no "respira". */
export const DARK_RADIUS = 190;
export const DARK_EDGE = 70;
export const darkEdge = (lowFx: boolean): number => (lowFx ? 0 : DARK_EDGE);
/** Opacidad de la capa oscura (la misma en la textura y en los rectángulos que la rodean). */
export const DARK_ALPHA = 0.93;
export const DARK_STEPS = 6;
/**
 * Cuantiza un alpha 0..255 del halo en escalones, SIN pasarse del alpha de los rectángulos (DARK_ALPHA):
 * si el escalón más alto llegaba a 255 la textura quedaba más oscura que el relleno y se veía un recuadro.
 */
export const quantizeDarkAlpha = (a: number): number => {
  const max = DARK_ALPHA * 255;
  const v = Math.min(Math.max(a, 0), max);
  return Math.min(max, Math.round((v / max) * DARK_STEPS) * (max / DARK_STEPS));
};

// --- Velocidad ---

export const SPEED_ROOM_MUL = 1.35;
/** Botín extra al limpiar la sala de velocidad: monedas si hay tienda en el piso (si no, no sirven) y una baya. */
export function speedRoomBonus(floorNum: number, hasShop: boolean): LootDrop[] {
  const out: LootDrop[] = [{ kind: 'berry', id: floorNum >= 4 ? 'zidra' : 'aranja' }];
  if (hasShop) out.push({ kind: 'coin', value: 5 }, { kind: 'coin', value: 2 + Math.max(1, Math.floor(floorNum)) });
  else out.push({ kind: 'bomb' });
  return out;
}
