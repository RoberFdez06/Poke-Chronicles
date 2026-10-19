// Eventos en salas (T39): de vez en cuando una sala de combate del piso es una sala sorpresa:
// - Pokémon raro que huye: si lo vences antes de que escape, buen premio.
// - Mercader ambulante: tres objetos con otros precios; al comprar uno se va.
// - Altar: das PS máximos (para el resto de la partida) a cambio de un objeto.
// - Cofre trampa: se abre sin llave, pero a veces es un enemigo (si lo vences, suelta el objeto).
// Sale de la semilla del piso, así al continuar o en el desafío diario es el mismo. Lógica pura, sin Phaser.
import type { Floor } from './floorGen.ts';
import { PASSIVE_ITEMS, takeMoveByRarity, type MovePower, type PassiveItem } from '../data/items.ts';
import type { ShopGoods, ShopSlot } from '../data/loot.ts';

export const ROOM_EVENTS = ['runaway', 'merchant', 'altar', 'trapChest'] as const;
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
};

/** Color de la marca en el minimapa (al descubrir la sala, hasta resolver el evento). */
export const ROOM_EVENT_COLOR: Record<RoomEventKind, number> = {
  runaway: 0x4fc3f7,
  merchant: 0x1abc9c,
  altar: 0xb388ff,
  trapChest: 0xd4a017,
};

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
  return { roomId: room.id, kind: ROOM_EVENTS[Math.min(ROOM_EVENTS.length - 1, Math.floor(which * ROOM_EVENTS.length))] };
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
