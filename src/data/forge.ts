// T73: huecos de objetos pasivos y forja (reciclar y fusionar). Lógica pura, sin Phaser, para poder testearla.
// Los objetos repetidos (el «x2» del HUD) ocupan un solo hueco: lo que cuenta son los ids distintos. Los activos y los
// consumibles (pociones, bayas, llaves…) no pasan por aquí porque no van en la lista de pasivos.
import {
  ITEM_SLOTS_BASE,
  ITEM_SLOTS_MAX,
  ITEM_SLOTS_PER_BOSS,
  MOVE_RARITIES,
  RANDOM_PASSIVES,
  passivePrice,
  passiveRarity,
  UPGRADE_MAX,
  upgradeable,
  type MoveRarity,
  type PassiveItem,
} from './items.ts';

/** Huecos que tienes con `bossesBeaten` jefes vencidos. */
export function itemSlots(bossesBeaten: number): number {
  const b = Math.max(0, Math.floor(bossesBeaten));
  return Math.min(ITEM_SLOTS_MAX, ITEM_SLOTS_BASE + b * ITEM_SLOTS_PER_BOSS);
}

/** Huecos ocupados: un hueco por objeto distinto. */
export const usedSlots = (passives: readonly string[]): number => new Set(passives).size;

/** Coger `id` ocupa un hueco nuevo solo si aún no lo llevas (las copias se apilan en el mismo). */
export const takesSlot = (id: string, passives: readonly string[]): boolean => !passives.includes(id);

/**
 * ¿Cabe `id`? Con los huecos llenos (o de sobra: las partidas antiguas pueden llevar más objetos que huecos y no se
 * les quita nada) solo caben copias de lo que ya llevas.
 */
export const canTakePassive = (id: string, passives: readonly string[], bossesBeaten: number): boolean =>
  !takesSlot(id, passives) || usedSlots(passives) < itemSlots(bossesBeaten);

/** Texto del HUD y la pausa: «7/10». */
export const slotsLabel = (passives: readonly string[], bossesBeaten: number): string => `${usedSlots(passives)}/${itemSlots(bossesBeaten)}`;

/** Suelta un objeto entero (todas sus copias: era un solo hueco). */
export const removePassive = (passives: readonly string[], id: string): string[] => passives.filter((p) => p !== id);

/** Quita una sola copia (la fusión gasta una de cada). */
export function removeOne(passives: readonly string[], id: string): string[] {
  const i = passives.indexOf(id);
  return i < 0 ? [...passives] : [...passives.slice(0, i), ...passives.slice(i + 1)];
}

/** Ids distintos que llevas, en el orden en que los cogiste (para las listas de la forja y de soltar). */
export const distinctPassives = (passives: readonly string[]): string[] => [...new Set(passives)];

// --- Reciclar ---

/** Parte del precio de la tienda que te dan al reciclar cada copia. */
export const RECYCLE_SHARE = 0.4;

/** Monedas por reciclar `id` (todas sus copias, que salen del mismo hueco). */
export function recycleCoins(id: string, passives: readonly string[]): number {
  const copies = passives.filter((p) => p === id).length;
  return Math.max(1, Math.round(passivePrice(id) * RECYCLE_SHARE)) * Math.max(1, copies);
}

/** Recicla: el objeto desaparece (libera su hueco) y te dan las monedas. */
export function recycle(passives: readonly string[], id: string): { passives: string[]; coins: number } {
  if (!passives.includes(id)) return { passives: [...passives], coins: 0 };
  return { passives: removePassive(passives, id), coins: recycleCoins(id, passives) };
}

// --- Fusionar ---

/** Rareza siguiente (null si ya es legendario: no se puede fusionar más). */
export function nextRarity(r: MoveRarity): MoveRarity | null {
  const i = MOVE_RARITIES.indexOf(r);
  return i >= 0 && i < MOVE_RARITIES.length - 1 ? MOVE_RARITIES[i + 1] : null;
}

/** Monedas que cuesta fusionar según la rareza del resultado (la fusión no es gratis para que reciclar compita). */
export const FUSE_COST: Record<MoveRarity, number> = { common: 0, rare: 5, epic: 8, legendary: 12 };

/** Por qué no se pueden fusionar `a` y `b` (null = sí se puede). */
export function fuseProblem(a: string, b: string, passives: readonly string[]): string | null {
  if (a === b) return 'Tienen que ser dos objetos distintos';
  if (!passives.includes(a) || !passives.includes(b)) return 'No llevas esos objetos';
  if (passiveRarity(a) !== passiveRarity(b)) return 'Tienen que ser de la misma rareza';
  if (!nextRarity(passiveRarity(a))) return 'Los legendarios ya no se pueden fusionar';
  return null;
}

/** Con qué se puede fusionar `a` (objetos distintos de la misma rareza que llevas). */
export const fusePartners = (a: string, passives: readonly string[]): string[] =>
  distinctPassives(passives).filter((b) => fuseProblem(a, b, passives) === null);

/** Coste de fusionar `a` y `b` (monedas). */
export const fuseCost = (a: string): number => FUSE_COST[nextRarity(passiveRarity(a)) ?? 'legendary'];

/**
 * Objeto que sale de fusionar `a` y `b`: uno al azar de la rareza siguiente que no lleves (si los llevas todos,
 * cualquiera de esa rareza). Usa una sola tirada de `rng`, así con un azar fijo se puede enseñar antes de aceptar.
 */
export function fuseResult(a: string, b: string, passives: readonly string[], rng: () => number, pool: readonly PassiveItem[] = RANDOM_PASSIVES): PassiveItem | null {
  if (fuseProblem(a, b, passives)) return null;
  const target = nextRarity(passiveRarity(a))!;
  const all = pool.filter((i) => passiveRarity(i.id) === target);
  if (all.length === 0) return null;
  const fresh = all.filter((i) => !passives.includes(i.id));
  const list = fresh.length > 0 ? fresh : all;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/** Aplica la fusión: gasta una copia de cada uno y añade el resultado. */
export function fuse(passives: readonly string[], a: string, b: string, result: string): string[] {
  return [...removeOne(removeOne(passives, a), b), result];
}

// --- Mejorar (+25 % por nivel, hasta 3) ---

/** Niveles de mejora por objeto (los que no están van a nivel 0). */
export type ItemLevels = Record<string, number>;

export const levelOf = (levels: Readonly<ItemLevels>, id: string): number => Math.max(0, Math.min(UPGRADE_MAX, Math.floor(levels[id] ?? 0)));

/**
 * Coste de subir `id` del nivel `level` al siguiente: la mitad del precio de tienda por cada nivel
 * (común 6/11/17, raro 8/15/23, épico 11/21/32, legendario 14/28/42). Cada nivel cuesta más que el anterior.
 */
export const upgradeCost = (id: string, level: number): number => Math.round(passivePrice(id) * 0.5 * (Math.max(0, Math.floor(level)) + 1));

/** Por qué no se puede mejorar `id` (null = sí se puede; las monedas se miran aparte). */
export function upgradeProblem(id: string, passives: readonly string[], levels: Readonly<ItemLevels>): string | null {
  if (!passives.includes(id)) return 'No llevas ese objeto';
  if (!upgradeable(id)) return 'Este objeto no tiene nada que mejorar';
  if (levelOf(levels, id) >= UPGRADE_MAX) return `Ya está al máximo (+${UPGRADE_MAX})`;
  return null;
}

/** Objetos que llevas y se pueden mejorar. */
export const upgradeCandidates = (passives: readonly string[], levels: Readonly<ItemLevels>): string[] =>
  distinctPassives(passives).filter((id) => upgradeProblem(id, passives, levels) === null);

/** Sube un nivel (copia nueva). */
export const upgrade = (levels: Readonly<ItemLevels>, id: string): ItemLevels => ({ ...levels, [id]: Math.min(UPGRADE_MAX, levelOf(levels, id) + 1) });

/** Nombre con su nivel: «Lupa +2» (sin nada a nivel 0). */
export const levelLabel = (name: string, level: number): string => (level > 0 ? `${name} +${level}` : name);

/** Quita los niveles de objetos que ya no llevas (reciclados, fusionados o soltados) y los inválidos. */
export function pruneLevels(levels: Readonly<ItemLevels>, passives: readonly string[]): ItemLevels {
  const out: ItemLevels = {};
  for (const [id, v] of Object.entries(levels)) {
    const lv = typeof v === 'number' && Number.isFinite(v) ? Math.min(UPGRADE_MAX, Math.floor(v)) : 0;
    if (lv > 0 && passives.includes(id)) out[id] = lv;
  }
  return out;
}

/** Guardado válido de niveles: objeto plano de enteros 0..3. */
export const isItemLevels = (v: unknown): v is ItemLevels =>
  !!v && typeof v === 'object' && !Array.isArray(v) &&
  Object.values(v as object).every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= UPGRADE_MAX);

// --- Evento de sala ---

/** Peso de la forja como sala sorpresa: no sale en los dos primeros pisos y gana peso cuanto más hondo. */
export function forgeWeight(floorNum: number): number {
  const f = Math.max(1, Math.floor(floorNum));
  return f < 3 ? 0 : Math.min(1.2, 0.3 + 0.1 * (f - 3));
}
