// Eventos en salas (T39): de vez en cuando una sala de combate del piso es una sala sorpresa:
// - Pokémon raro que huye: si lo vences antes de que escape, buen premio.
// - Mercader ambulante: tres objetos con otros precios; al comprar uno se va.
// - Altar: das PS máximos (para el resto de la partida) a cambio de un objeto.
// - Cofre trampa: se abre sin llave, pero a veces es un enemigo (si lo vences, suelta el objeto).
// T48:
// - Entrenador rival: oleadas cortas; al ganar, el doble de tickets de la sala.
// - Fuente curativa: cura la mitad de los PS pagando monedas, o gratis a cambio de ir más lento unas salas.
// - Sala del tiempo: 20 s de reloj; si la limpias antes sale un objeto, si no, entran más enemigos.
// - Huevo misterioso: lo llevas y eclosiona tras 2 salas limpiadas en un ayudante o un objeto.
// Sale de la semilla del piso, así al continuar o en el desafío diario es el mismo. Lógica pura, sin Phaser.
import type { Floor } from './floorGen.ts';
import { PASSIVE_ITEMS, takeMoveByRarity, type MovePower, type PassiveItem } from '../data/items.ts';
import type { ShopGoods, ShopSlot } from '../data/loot.ts';

export const ROOM_EVENTS = ['runaway', 'merchant', 'altar', 'trapChest', 'rival', 'fountain', 'timeTrial', 'egg'] as const;
export type RoomEventKind = (typeof ROOM_EVENTS)[number];

export interface RoomEvent {
  roomId: number;
  kind: RoomEventKind;
}

export const ROOM_EVENT_LABEL: Record<RoomEventKind, string> = {
  runaway: 'Pokémon raro',
  merchant: 'Mercader ambulante',
  altar: 'Altar',
  trapChest: 'Cofre misterioso',
  rival: 'Entrenador rival',
  fountain: 'Fuente curativa',
  timeTrial: 'Sala del tiempo',
  egg: 'Huevo misterioso',
};

/** Color de la marca en el minimapa (al descubrir la sala, hasta resolver el evento). */
export const ROOM_EVENT_COLOR: Record<RoomEventKind, number> = {
  runaway: 0x4fc3f7,
  merchant: 0x1abc9c,
  altar: 0xb388ff,
  trapChest: 0xd4a017,
  rival: 0xe53935,
  fountain: 0x64b5f6,
  timeTrial: 0xffb300,
  egg: 0xf8bbd0,
};

/** Premio y riesgo de cada evento, para el aviso al entrar. */
export const ROOM_EVENT_DESC: Record<RoomEventKind, string> = {
  runaway: 'Véncelo antes de que huya: tickets y un objeto',
  merchant: 'Tres objetos con otros precios; compras uno y se va',
  altar: 'Da PS máximos a cambio de un objeto',
  trapChest: 'Se abre sin llave… pero puede ser una trampa',
  rival: 'Oleadas cortas: si ganas, el doble de tickets',
  fountain: 'Cura la mitad de tus PS: con monedas o yendo más lento',
  timeTrial: '20 s: si limpias a tiempo, un objeto; si no, más enemigos',
  egg: 'Llévalo 2 salas: eclosiona en un ayudante o un objeto',
};

/**
 * Peso de cada evento según el piso (T48): al principio más huevos, fuentes y mercaderes; hondo, más rivales y salas
 * del tiempo. 0 = no sale en ese piso.
 */
export function eventWeights(floorNum: number): Record<RoomEventKind, number> {
  const f = Math.max(1, Math.floor(floorNum));
  const deep = Math.min(1, (f - 2) / 3); // 0 en el piso 2, 1 desde el 5
  return {
    runaway: 1,
    merchant: 1.2 - 0.4 * deep,
    altar: 0.6 + 0.4 * deep,
    trapChest: 1,
    rival: 0.6 + 0.8 * deep,
    fountain: 1.2 - 0.4 * deep,
    timeTrial: f >= 3 ? 0.6 + 0.8 * deep : 0,
    egg: 1.2 - 0.6 * deep,
  };
}

/** Elige evento con los pesos del piso; `x` en [0, 1). */
export function pickEventKind(floorNum: number, x: number): RoomEventKind {
  const w = eventWeights(floorNum);
  const total = ROOM_EVENTS.reduce((a, k) => a + w[k], 0);
  let r = Math.min(0.999999, Math.max(0, x)) * total;
  for (const k of ROOM_EVENTS) {
    if (r < w[k]) return k;
    r -= w[k];
  }
  return ROOM_EVENTS.filter((k) => w[k] > 0).pop()!;
}

/** Probabilidad de que un piso (desde el 2) tenga una sala sorpresa: más o menos uno de cada tres. */
export const EVENT_CHANCE = 0.35;

/**
 * Sala sorpresa del piso (o null). Una sala de combate que no sea de las de `exclude` (minijefe, cofres…), mejor
 * sin salida. Siempre hace tres tiradas de `rng`.
 */
export function pickRoomEvent(floor: Floor, floorNum: number, rng: () => number, exclude: ReadonlySet<number> = new Set()): RoomEvent | null {
  const roll = rng();
  const which = rng();
  const where = rng();
  if (floorNum <= 1 || roll >= EVENT_CHANCE) return null;
  const combat = floor.rooms.filter((r) => r.kind === 'combat' && !exclude.has(r.id) && !(floor.chestRooms ?? []).includes(r.id));
  if (combat.length === 0) return null;
  const ends = combat.filter((r) => Object.keys(r.doors).length === 1);
  const pool = ends.length > 0 ? ends : combat;
  const room = pool[Math.min(pool.length - 1, Math.floor(where * pool.length))];
  return { roomId: room.id, kind: pickEventKind(floorNum, which) };
}

// --- Pokémon raro que huye ---

/** Segundos que tarda en escapar. */
export const RUNAWAY_SECONDS = 12;
/** Vida respecto a un enemigo normal (aguanta algo, pero se puede vencer a tiempo). */
export const RUNAWAY_HP_MUL = 2.5;
/** Tickets por vencerlo (además de un objeto). */
export const runawayTickets = (floorNum: number): number => 3 + Math.max(1, Math.floor(floorNum));

// --- Mercader ---

/** Precios del mercader: una ganga, uno normal y uno caro (que suele ser un objeto que aún no tienes). */
export const MERCHANT_PRICES = [8, 14, 22] as const;

/**
 * Los tres artículos del mercader: pasivos (mejor que no tengas) o poderes de `movePool` (se quitan de ahí, como
 * en la tienda). Nunca pociones.
 */
export function merchantStock(
  rng: () => number,
  ownedPassives: ReadonlySet<string>,
  movePool: MovePower[],
  pool: readonly PassiveItem[] = PASSIVE_ITEMS,
  floor = 1,
): ShopSlot[] {
  const used = new Set<string>();
  return MERCHANT_PRICES.map((price) => {
    let goods: ShopGoods;
    if (movePool.length > 0 && rng() < 0.35) {
      goods = { kind: 'move', move: takeMoveByRarity(rng, movePool, floor) };
    } else {
      const fresh = pool.filter((i) => !ownedPassives.has(i.id) && !used.has(i.id));
      const list = fresh.length > 0 ? fresh : pool;
      const item = list[Math.floor(rng() * list.length)];
      used.add(item.id);
      goods = { kind: 'passive', id: item.id };
    }
    return { goods, price, sold: false };
  });
}

// --- Altar ---

/** PS máximos que pide el altar: un 15 % de los que tienes (al menos 5). */
export const altarCost = (maxHp: number): number => Math.max(5, Math.round(maxHp * 0.15));
/** Nunca te deja con menos de esto de PS máximos (si no llegas, el altar no acepta). */
export const ALTAR_MIN_HP = 30;
export const canUseAltar = (maxHp: number): boolean => maxHp - altarCost(maxHp) >= ALTAR_MIN_HP;

// --- Cofre trampa ---

/** Probabilidad de que el cofre sea un enemigo. */
export const TRAP_CHANCE = 0.45;
export const trapChestOutcome = (rng: () => number): 'item' | 'monster' => (rng() < TRAP_CHANCE ? 'monster' : 'item');

// --- Entrenador rival (T48) ---

/** Oleadas del rival. */
export const RIVAL_WAVES = 3;
/** Enemigos de cada oleada: cortas, pero cada una algo mayor y más con el piso. */
export const rivalWaveSize = (floorNum: number, wave: number): number => Math.min(6, 2 + Math.floor((Math.max(1, floorNum) - 1) / 2) + (wave - 1));
/** Tickets extra al ganar: otros tantos como da la sala (en total, el doble). */
export const rivalBonus = (roomTickets: number): number => Math.max(1, roomTickets);

// --- Fuente curativa (T48) ---

/** Parte de los PS máximos que cura. */
export const FOUNTAIN_HEAL = 0.5;
/** Precio en monedas (sube con el piso). */
export const fountainPrice = (floorNum: number): number => 6 + 2 * Math.max(1, Math.floor(floorNum));
/** Sin pagar: velocidad ×0,8 durante estas salas limpiadas. */
export const FOUNTAIN_TIRED_ROOMS = 2;
export const FOUNTAIN_TIRED_SPEED = 0.8;
export const fountainHeal = (maxHp: number): number => Math.max(1, Math.round(maxHp * FOUNTAIN_HEAL));

// --- Sala del tiempo (T48) ---

export const TIME_TRIAL_SECONDS = 20;
/** Enemigos al empezar y los que entran si se acaba el tiempo. */
export const timeTrialSize = (floorNum: number): number => Math.min(8, 4 + Math.floor(Math.max(1, floorNum) / 2));
export const timeTrialExtra = (floorNum: number): number => Math.min(6, 2 + Math.floor(Math.max(1, floorNum) / 2));

// --- Huevo misterioso (T48) ---

/** Salas limpiadas hasta que eclosiona. */
export const EGG_ROOMS = 2;
/** Lo que sale del huevo: un ayudante (te acompaña el resto del piso) o un objeto. */
export const EGG_HELPER_CHANCE = 0.6;
export const eggHatch = (rng: () => number): 'helper' | 'item' => (rng() < EGG_HELPER_CHANCE ? 'helper' : 'item');
/** Cuenta atrás del huevo al limpiar una sala; devuelve las que quedan (0 = eclosiona ahora). */
export const eggTick = (left: number): number => Math.max(0, left - 1);
/** Daño del ayudante por golpe (respecto a tu disparo) y cada cuánto ataca. */
export const HELPER_DAMAGE_MUL = 0.6;
export const HELPER_ATTACK_MS = 1100;
