// Partida en curso guardada en 3 huecos, como en Isaac: se guarda sola (al entrar en una sala,
// al limpiarla, al coger un objeto y al salir desde la pausa) y se borra al morir o al ganar.
// Tickets y desbloqueos NO van aquí: son comunes a todos los huecos (ver save.ts).
// Lógica pura, sin Phaser, para poder testearla.
import { activeStorage, type StorageLike } from './storage.ts';
import { computeStats, type MovePower } from './items.ts';
import { isMode, type GameMode } from './modes.ts';
import { isDifficulty, type Difficulty } from './difficulty.ts';
import { emptyCounters, isCounters, type RunCounters } from './runHistory.ts';
import { BERRIES, POTIONS, type ShopSlot } from './loot.ts';
import { isPowerFormSave, type PowerFormSave } from './powerForm.ts';

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
 * v11: desafío diario (los v10 no lo eran).
 * v12: dificultad (los v11 eran todos Normal).
 * v13: salas sorpresa ya resueltas en el piso y PS máximos dados en altares (los v12 no tenían).
 * v14: huevo misterioso, ayudante y cansancio de la fuente (T48; los v13 no tenían).
 * v15: pociones que llevas y pociones en el suelo (T49; los v14 no tenían).
 * v18: tiradas de la tragaperras y lanzamientos de pesca por sala (T68/T69; los v17 no tenían).
 * v19: jefes vencidos, que dan huecos de objetos (T73). Los v18 se migran contando los jefes que ya habían salido
 *      menos el actual; no se les quita ningún objeto aunque lleven más que huecos.
 * v20: forma de poder (megaevolución, T74): cuánto le queda y si ya se usó en el piso. Los v19 no la tenían.
 * v21: medidor de poder y Cristal Z usado (T75). La forma guarda además el tipo Tera y el escudo del Dinamax.
 * v22: historias con decisiones ya vistas en la partida (T79), para que cada una salga una sola vez.
 */
export const RUN_VERSION = 22;
export const runKey = (slot: number) => `pokeisaac.run.${slot}`;

/** Objeto en el suelo. Los pasivos se guardan por id (sus efectos están en items.ts); monedas y bayas, en loot.ts. */
export type SavedDrop =
  | { kind: 'passive'; id: string }
  | { kind: 'move'; move: MovePower }
  | { kind: 'coin'; value: number }
  | { kind: 'berry'; id: keyof typeof BERRIES }
  | { kind: 'key' }
  | { kind: 'bomb' }
  | { kind: 'potion' }
  | { kind: 'active'; id: string };

/**
 * Diseño del piso: 1 = sin Centro ni tienda (partidas de antes de v4), 2 = con ellos, 3 = además sala secreta,
 * sala de desafío y cofres.
 */
export const FLOOR_LAYOUT = 4;

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
  /** Desafío diario (T34): día y si es la partida que cuenta para el récord; null = partida normal. */
  daily: DailyRun | null;
  /** Fácil, Normal o Difícil (T40). */
  difficulty: Difficulty;
  /** Salas sorpresa (T39) de este piso ya resueltas. */
  eventsDone: number[];
  /** PS máximos dados en altares en toda la partida (se restan de los máximos). */
  hpSacrificed: number;
  /** T48: salas que le quedan al huevo para eclosionar (0 = no llevas), ayudante (id de especie, 0 = ninguno) y salas
   *  que te quedan de cansancio por beber gratis en la fuente. */
  eggLeft: number;
  allyId: number;
  tiredRooms: number;
  /** T49: pociones que llevas (se usan con su tecla). */
  potions: number;
  /** T57: ya se ha usado la segunda oportunidad («Una más») en esta partida. */
  secondChance: boolean;
  /** T65: ya has capturado en este piso y ayudante del huevo que llevabas antes de capturar (el capturado está en
   *  `allyId` hasta cambiar de piso); -1 = no hay aliado capturado. */
  captureDone: boolean;
  capturePrevAlly: number;
  /** T68/T69: tiradas de la tragaperras y lanzamientos de pesca ya hechos, como pares [sala, cantidad]. */
  slotSpins: [number, number][];
  fishCasts: [number, number][];
  /** T73: jefes vencidos en la partida (cada uno da un hueco de objeto más, ver items.ts). */
  bossesBeaten: number;
  /** T74: forma de poder activa (megaevolución), lo que le queda (ms) y si ya se ha usado en este piso. */
  powerForm: PowerFormSave;
  /** T75: medidor de poder (0..100) y si ya se ha usado el Cristal Z en la partida. */
  powerMeter: number;
  zUsed: boolean;
  /** T79: ids de las historias con decisiones ya vistas (ver level/choiceEvents.ts). */
  storiesSeen: string[];
}

export interface DailyRun {
  day: number;
  counts: boolean;
}

const isInt = (n: unknown): n is number => Number.isInteger(n);
const isIntArray = (a: unknown): a is number[] => Array.isArray(a) && a.every(isInt);

const isPairs = (a: unknown): a is [number, number][] =>
  Array.isArray(a) && a.every((p) => Array.isArray(p) && p.length === 2 && isInt(p[0]) && isInt(p[1]) && p[1] >= 0);

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
  if (o.kind === 'key' || o.kind === 'bomb' || o.kind === 'potion') return true;
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

/** v10 no tenía desafío diario. */
function migrateV10(d: RunSave): RunSave {
  return { ...d, version: 11, daily: null };
}

/** v11 no tenía dificultad: era la Normal. */
function migrateV11(d: RunSave): RunSave {
  return { ...d, version: 12, difficulty: 'normal' };
}

/** v12 no tenía salas sorpresa. */
function migrateV12(d: RunSave): RunSave {
  return { ...d, version: 13, eventsDone: [], hpSacrificed: 0 };
}

/** v13 no tenía huevo, ayudante ni cansancio. */
function migrateV13(d: RunSave): RunSave {
  return { ...d, version: 14, eggLeft: 0, allyId: 0, tiredRooms: 0 };
}

/** v14 no tenía pociones. */
function migrateV14(d: RunSave): RunSave {
  return { ...d, version: 15, potions: 0 };
}

/** v15 no tenía la segunda oportunidad (T57): sin usar. */
function migrateV15(d: RunSave): RunSave {
  return { ...d, version: 16, secondChance: false };
}

/** v16 no tenía captura (T65): sin capturar en el piso. */
function migrateV16(d: RunSave): RunSave {
  return { ...d, version: 17, captureDone: false, capturePrevAlly: -1 };
}

/** v17 no guardaba las tiradas ni los lanzamientos (T68/T69): empiezan a cero. */
function migrateV17(d: RunSave): RunSave {
  return { ...d, version: 18, slotSpins: [], fishCasts: [] };
}

/**
 * v18 no contaba los jefes vencidos (T73). `bossHistory` guarda los que han salido, y el del piso actual puede no
 * estar vencido: se cuenta uno menos para no regalar un hueco. Los objetos que ya llevabas no se tocan.
 */
function migrateV18(d: RunSave): RunSave {
  const seen = Array.isArray(d.bossHistory) ? d.bossHistory.length : 0;
  return { ...d, version: 19, bossesBeaten: Math.max(0, seen - 1) };
}

/** v19 no tenía formas de poder (T74): sin forma activa y sin usar en el piso. */
function migrateV19(d: RunSave): RunSave {
  return { ...d, version: 20, powerForm: { active: null, leftMs: 0, used: false } };
}

/** v20 no tenía medidor de poder ni Cristal Z (T75): medidor vacío y Z sin usar. */
function migrateV20(d: RunSave): RunSave {
  return { ...d, version: 21, powerMeter: 0, zUsed: false };
}

/** v21 no tenía historias con decisiones (T79): ninguna vista. */
function migrateV21(d: RunSave): RunSave {
  return { ...d, version: 22, storiesSeen: [] };
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
  if (d.version === 10) d = migrateV10(d);
  if (d.version === 11) d = migrateV11(d);
  if (d.version === 12) d = migrateV12(d);
  if (d.version === 13) d = migrateV13(d);
  if (d.version === 14) d = migrateV14(d);
  if (d.version === 15) d = migrateV15(d);
  if (d.version === 16) d = migrateV16(d);
  if (d.version === 17) d = migrateV17(d);
  if (d.version === 18) d = migrateV18(d);
  if (d.version === 19) d = migrateV19(d);
  if (d.version === 20) d = migrateV20(d);
  if (d.version === 21) d = migrateV21(d);
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
    Array.isArray(d.shop) && d.shop.every(isShopSlot) && [1, 2, 3, 4].includes(d.layout) &&
    isInt(d.keys) && d.keys >= 0 && isInt(d.bombs) && d.bombs >= 0 && isIntArray(d.openedChests) &&
    Array.isArray(d.revealedDoors) && d.revealedDoors.every((k) => typeof k === 'string') &&
    (d.active === null || (!!d.active && typeof d.active.id === 'string' && isInt(d.active.charge) && d.active.charge >= 0)) &&
    typeof d.healed === 'boolean' && isCounters(d.counters) &&
    (d.daily === null || (!!d.daily && isInt(d.daily.day) && typeof d.daily.counts === 'boolean')) &&
    isDifficulty(d.difficulty) && isIntArray(d.eventsDone) && isInt(d.hpSacrificed) && d.hpSacrificed >= 0 &&
    isInt(d.eggLeft) && d.eggLeft >= 0 && isInt(d.allyId) && d.allyId >= 0 && isInt(d.tiredRooms) && d.tiredRooms >= 0 && isInt(d.potions) && d.potions >= 0 &&
    typeof d.secondChance === 'boolean' && typeof d.captureDone === 'boolean' && isInt(d.capturePrevAlly) && d.capturePrevAlly >= -1 &&
    isPairs(d.slotSpins) && isPairs(d.fishCasts) && isInt(d.bossesBeaten) && d.bossesBeaten >= 0 &&
    isPowerFormSave(d.powerForm) &&
    typeof d.powerMeter === 'number' && Number.isFinite(d.powerMeter) && d.powerMeter >= 0 && d.powerMeter <= 100 && typeof d.zUsed === 'boolean' &&
    Array.isArray(d.storiesSeen) && d.storiesSeen.every((k) => typeof k === 'string');
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
