// Partida en curso guardada en 3 huecos, como en Isaac: se guarda sola (al entrar en una sala,
// al limpiarla, al coger un objeto y al salir desde la pausa) y se borra al morir o al ganar.
// Tickets y desbloqueos NO van aquí: son comunes a todos los huecos (ver save.ts).
// Lógica pura, sin Phaser, para poder testearla.
import { activeStorage, type StorageLike } from './storage.ts';
import { computeStats, type MovePower } from './items.ts';
import { isMode, type GameMode } from './modes.ts';
import { emptyCounters, isCounters, type RunCounters } from './runHistory.ts';
import { BERRIES, POTIONS, type ShopSlot } from './loot.ts';

export const RUN_SLOTS = 3;
/**
 * v2: número de piso y jefes ya vistos (los guardados v1 se migran al piso 1).
 * v3: modo de juego (los v2 eran todos del modo Normal).
 * v4: monedas de la partida, Centro Pokémon, tienda y monedas/bayas en el suelo. Los pisos v3 se
 *     generaron sin Centro ni tienda (`layout` 1) y se siguen generando así para que cuadren.
 * v5: PS máximos (dependen de las estadísticas del Pokémon) para mostrarlos sin cargarlo.
 * v6: forma actual del Pokémon (evoluciona durante la partida); los v5 aún no habían evolucionado.
 * v7: llaves, bombas, cofres abiertos y paredes secretas abiertas. Los pisos de v6 siguen con su diseño (2),
 *     sin sala secreta, de desafío ni cofres.
 * v8: objeto activo (y su carga) y objetos activos en el suelo.
 */
export const RUN_VERSION = 10;
export const runKey = (slot: number) => `pokeisaac.run.${slot}`;

/** Objeto en el suelo. Los pasivos se guardan por id (sus efectos están en items.ts); monedas y bayas, en loot.ts. */
export type SavedDrop =
  | { kind: 'passive'; id: string }
  | { kind: 'move'; move: MovePower }
  | { kind: 'coin'; value: number }
  | { kind: 'berry'; id: keyof typeof BERRIES }
  | { kind: 'key' }
  | { kind: 'bomb' }
  | { kind: 'active'; id: string };

/**
 * Diseño del piso: 1 = sin Centro ni tienda (partidas de antes de v4), 2 = con ellos, 3 = además sala secreta,
 * sala de desafío y cofres.
 */
export const FLOOR_LAYOUT = 3;

export interface FloorItemSave {
  roomId: number;
  x: number;
  y: number;
  drop: SavedDrop;
}

export interface RunSave {
  version: number;
  /** Fecha del guardado (ms desde 1970). */
  savedAt: number;
  /** Pokémon elegido (sus mejoras son las que cuentan) y la forma en la que va ahora (evolucionado o no). */
  starterId: number;
  formId: number;
  starterName: string;
  mode: GameMode;
  /** Por dónde vas: piso (Normal, Infinito), ronda (Oleadas) o jefe (Rush de jefes); 1 = el primero. */
  floor: number;
  /** Jefes que ya han salido en la partida (para no repetirlos). */
  bossHistory: number[];
  /** El piso se regenera igual a partir de la semilla y el número de salas. */
  floorSeed: number;
  roomCount: number;
  bossId: number;
  /** Sala en la que estabas. Si no estaba limpia, al continuar se reinicia con los enemigos enteros. */
  roomId: number;
  visited: number[];
  cleared: number[];
  hp: number;
  /** PS máximos al guardar (estadísticas del Pokémon + objetos). */
  maxHp: number;
  passives: string[];
  slots: (MovePower | null)[];
  nextSlotReplace: number;
  movePool: MovePower[];
  floorItems: FloorItemSave[];
  /** Tickets ganados en esta partida (ya están sumados al total). */
  earned: number;
  /** Monedas de la partida (solo para la tienda; se pierden al acabar). */
  coins: number;
  /** El Centro Pokémon de este piso ya se ha usado. */
  centerUsed: boolean;
  /** Artículos de la tienda de este piso (vacío si aún no se ha generado o no hay tienda). */
  shop: ShopSlot[];
  layout: number;
  keys: number;
  bombs: number;
  /** Salas cuyo cofre ya se ha abierto y puertas ocultas ya abiertas con bomba ("sala:dirección"). */
  openedChests: number[];
  revealedDoors: string[];
  /** Objeto activo que llevas y cuántas salas lleva cargadas (null = ninguno). */
  active: { id: string; charge: number } | null;
  /** Te has curado en algún momento de la partida (misiones y logros "sin curarte"). */
  healed: boolean;
  /** Tiempo, enemigos vencidos, daño hecho y récord, para el resumen al acabar (T28). */
  counters: RunCounters;
}

const isInt = (n: unknown): n is number => Number.isInteger(n);
const isIntArray = (a: unknown): a is number[] => Array.isArray(a) && a.every(isInt);

function isMove(m: unknown): m is MovePower {
  const o = m as MovePower;
  return !!o && typeof o.name === 'string' && typeof o.type === 'string' && typeof o.power === 'number' &&
    typeof o.shape === 'string' && typeof o.cooldown === 'number';
}

function isDrop(d: unknown): d is SavedDrop {
  const o = d as SavedDrop;
  if (!o) return false;
  if (o.kind === 'passive') return typeof o.id === 'string';
  if (o.kind === 'coin') return isInt(o.value) && o.value > 0;
  if (o.kind === 'berry') return o.id in BERRIES;
  if (o.kind === 'key' || o.kind === 'bomb') return true;
  if (o.kind === 'active') return typeof o.id === 'string';
  return o.kind === 'move' && isMove(o.move);
}

/** v1 no tenía pisos: la partida estaba siempre en el primero. */
function migrateV1(d: RunSave): RunSave {
  return { ...d, version: 2, floor: 1, bossHistory: isInt(d.bossId) ? [d.bossId] : [] };
}

/** v2 no tenía modos: todas las partidas eran del modo Normal. */
function migrateV2(d: RunSave): RunSave {
  return { ...d, version: 3, mode: 'normal' };
}

/** v3 no tenía monedas, Centro ni tienda; su piso se generó sin ellos. */
function migrateV3(d: RunSave): RunSave {
  return { ...d, version: 4, coins: 0, centerUsed: false, shop: [], layout: 1 };
}

function isShopSlot(s: unknown): s is ShopSlot {
  const o = s as ShopSlot;
  if (!o || !isInt(o.price) || typeof o.sold !== 'boolean' || !o.goods) return false;
  const g = o.goods;
  if (g.kind === 'potion') return g.id in POTIONS;
  if (g.kind === 'passive') return typeof g.id === 'string';
  return g.kind === 'move' && isMove(g.move);
}

/** v4 no guardaba los PS máximos: eran siempre los de por defecto con los objetos. */
function migrateV4(d: RunSave): RunSave {
  const passives = Array.isArray(d.passives) ? d.passives.filter((p) => typeof p === 'string') : [];
  return { ...d, version: 5, maxHp: computeStats(passives).maxHp };
}

/** v5 no evolucionaba: la forma es la del Pokémon elegido. */
function migrateV5(d: RunSave): RunSave {
  return { ...d, version: 6, formId: d.starterId };
}

/** v6 no tenía llaves ni bombas: empiezas con una bomba, como en una partida nueva. */
function migrateV6(d: RunSave): RunSave {
  return { ...d, version: 7, keys: 0, bombs: 1, openedChests: [], revealedDoors: [] };
}

/** v7 no tenía objetos activos. */
function migrateV7(d: RunSave): RunSave {
  return { ...d, version: 8, active: null };
}

/** v8 no sabía si te habías curado: se cuenta que sí (no regala la misión "sin curarte"). */
function migrateV8(d: RunSave): RunSave {
  return { ...d, version: 9, healed: true };
}

/** v9 no llevaba los contadores del resumen: empiezan de cero. */
function migrateV9(d: RunSave): RunSave {
  return { ...d, version: 10, counters: emptyCounters() };
}

/** Lee un guardado; si está corrupto o es de otra versión, devuelve null (hueco vacío). */
export function parseRun(raw: string | null): RunSave | null {
  if (!raw) return null;
  let d: RunSave;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object') return null;
  if (d.version === 1) d = migrateV1(d);
  if (d.version === 2) d = migrateV2(d);
  if (d.version === 3) d = migrateV3(d);
  if (d.version === 4) d = migrateV4(d);
  if (d.version === 5) d = migrateV5(d);
  if (d.version === 6) d = migrateV6(d);
  if (d.version === 7) d = migrateV7(d);
  if (d.version === 8) d = migrateV8(d);
  if (d.version === 9) d = migrateV9(d);
  if (d.version !== RUN_VERSION) return null;
  const ok =
    isInt(d.savedAt) && isInt(d.starterId) && isInt(d.formId) && typeof d.starterName === 'string' && isMode(d.mode) &&
    isInt(d.floor) && d.floor >= 1 && isIntArray(d.bossHistory) &&
    isInt(d.floorSeed) && isInt(d.roomCount) && isInt(d.bossId) && isInt(d.roomId) &&
    isIntArray(d.visited) && isIntArray(d.cleared) && typeof d.hp === 'number' && d.hp > 0 && isInt(d.maxHp) && d.maxHp > 0 &&
    Array.isArray(d.passives) && d.passives.every((p) => typeof p === 'string') &&
    Array.isArray(d.slots) && d.slots.every((m) => m === null || isMove(m)) &&
    isInt(d.nextSlotReplace) && Array.isArray(d.movePool) && d.movePool.every(isMove) &&
    Array.isArray(d.floorItems) &&
    d.floorItems.every((f) => !!f && isInt(f.roomId) && typeof f.x === 'number' && typeof f.y === 'number' && isDrop(f.drop)) &&
    isInt(d.earned) && isInt(d.coins) && d.coins >= 0 && typeof d.centerUsed === 'boolean' &&
    Array.isArray(d.shop) && d.shop.every(isShopSlot) && [1, 2, 3].includes(d.layout) &&
    isInt(d.keys) && d.keys >= 0 && isInt(d.bombs) && d.bombs >= 0 && isIntArray(d.openedChests) &&
    Array.isArray(d.revealedDoors) && d.revealedDoors.every((k) => typeof k === 'string') &&
    (d.active === null || (!!d.active && typeof d.active.id === 'string' && isInt(d.active.charge) && d.active.charge >= 0)) &&
    typeof d.healed === 'boolean' && isCounters(d.counters);
  return ok ? d : null;
}

/** El almacenamiento en uso: memoria (invitado), nube (cuenta) o el navegador (pruebas). Ver storage.ts (T45). */
const browserStorage = (): StorageLike | null => activeStorage();

const validSlot = (slot: number) => isInt(slot) && slot >= 0 && slot < RUN_SLOTS;

export function loadRun(slot: number, storage: StorageLike | null = browserStorage()): RunSave | null {
  if (!validSlot(slot)) return null;
  try {
    return parseRun(storage?.getItem(runKey(slot)) ?? null);
  } catch {
    return null;
  }
}

/** Los 3 huecos en orden; null = vacío. */
export function loadAllRuns(storage: StorageLike | null = browserStorage()): (RunSave | null)[] {
  return Array.from({ length: RUN_SLOTS }, (_, i) => loadRun(i, storage));
}

export function saveRun(slot: number, run: RunSave, storage: StorageLike | null = browserStorage()): boolean {
  if (!validSlot(slot)) return false;
  try {
    storage?.setItem(runKey(slot), JSON.stringify(run));
    return !!storage;
  } catch {
    return false; // sin espacio o sin almacenamiento
  }
}

/** Borra la partida del hueco (al morir o al completar el piso). Se guarda vacío para no depender de removeItem. */
export function clearRun(slot: number, storage: StorageLike | null = browserStorage()) {
  if (!validSlot(slot)) return;
  try {
    storage?.setItem(runKey(slot), '');
  } catch {
    // nada
  }
}
