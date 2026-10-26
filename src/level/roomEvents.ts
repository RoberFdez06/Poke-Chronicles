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
// T68:
// - Sala de juegos: una tragaperras que se juega con monedas (ver slotMachine.ts).
// T70:
// - Ladrón: te roba monedas y huye hacia una puerta (ver thief.ts).
// T69:
// - Laguna de pesca: lanzas la caña y pulsas cuando pica (ver fishing.ts).
// T73:
// - Forja: reciclar un objeto por monedas o fusionar dos de la misma rareza (ver data/forge.ts).
// Mega Piedra:
// - Santuario de la Mega Piedra: sala dedicada, una por piso, con la Mega Piedra (ver pickMegaStoneRoom).
// Sale de la semilla del piso, así al continuar o en el desafío diario es el mismo. Lógica pura, sin Phaser.
import { mulberry32, type Floor } from './floorGen.ts';
import { RANDOM_PASSIVES, takeMoveByRarity, type MovePower, type PassiveItem } from '../data/items.ts';
import { fishingWeight } from './fishing.ts';
import { forgeWeight } from '../data/forge.ts';
import type { ShopGoods, ShopSlot } from '../data/loot.ts';

export const ROOM_EVENTS = ['runaway', 'merchant', 'altar', 'trapChest', 'rival', 'fountain', 'timeTrial', 'egg', 'slots', 'thief', 'fishing', 'forge', 'megaStone'] as const;
export type RoomEventKind = (typeof ROOM_EVENTS)[number];

/**
 * Eventos del desafío diario: tabla CONGELADA con los que existían antes de T68 (mismo orden). Los pesos y las reglas
 * son los de `eventWeights`, que para estos ocho no han cambiado. Añadir eventos nuevos a ROOM_EVENTS no toca esta
 * lista, así que el reto del día sale igual en todas las versiones. Solo se cambia a propósito, para versionar el reto.
 */
export const DAILY_EVENTS: readonly RoomEventKind[] = ['runaway', 'merchant', 'altar', 'trapChest', 'rival', 'fountain', 'timeTrial', 'egg'];

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
  slots: 'Sala de juegos',
  thief: 'Ladrón',
  fishing: 'Laguna de pesca',
  forge: 'Forja',
  megaStone: 'Santuario de la Mega Piedra',
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
  slots: 0xff7043,
  thief: 0x8d6e63,
  fishing: 0x0288d1,
  forge: 0xe67e22,
  megaStone: 0x8fd3ff, // el color de la propia Mega Piedra
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
  slots: 'Tragaperras con monedas: apuesta 3, 6 o 12 (tiradas limitadas)',
  thief: 'Te roba monedas y huye: abátelo antes de que salga y te las devuelve con extra',
  fishing: 'Lanza la caña y pulsa cuando pique: monedas, bayas, objetos… o algo raro',
  forge: 'Recicla un objeto por monedas o fusiona dos de la misma rareza en uno mejor',
  megaStone: 'Una Mega Piedra por piso: sin ella no hay megaevolución',
};

/**
 * Peso de cada evento según el piso (T48): al principio más huevos, fuentes y mercaderes; hondo, más rivales y salas
 * del tiempo. 0 = no sale en ese piso.
 */
export function eventWeights(floorNum: number, biomeTypes: readonly string[] = []): Record<RoomEventKind, number> {
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
    slots: 0.7, // T68: poco peso y fijo; solo cuesta monedas
    thief: 0.5 + 0.3 * deep, // T70: algo más hondo, cuando llevas más monedas
    fishing: fishingWeight(biomeTypes), // T69: sobre todo en biomas con agua
    forge: forgeWeight(f), // T73: más probable cuanto más hondo
    megaStone: 0, // nunca sale al sortear: tiene su propia sala fija por piso (pickMegaStoneRoom)
  };
}

/** Elige evento con los pesos del piso entre `kinds` (por defecto todos; el desafío diario pasa DAILY_EVENTS); `x` en [0, 1). */
export function pickEventKind(floorNum: number, x: number, biomeTypes: readonly string[] = [], kinds: readonly RoomEventKind[] = ROOM_EVENTS): RoomEventKind {
  const w = eventWeights(floorNum, biomeTypes);
  const total = kinds.reduce((a, k) => a + w[k], 0);
  let r = Math.min(0.999999, Math.max(0, x)) * total;
  for (const k of kinds) {
    if (r < w[k]) return k;
    r -= w[k];
  }
  return kinds.filter((k) => w[k] > 0).pop()!;
}

/** Probabilidad de que un piso (desde el 2) tenga una sala sorpresa: más o menos uno de cada tres. */
export const EVENT_CHANCE = 0.35;

/**
 * Sala sorpresa del piso (o null). Una sala de combate que no sea de las de `exclude` (minijefe, cofres…), mejor
 * sin salida. Siempre hace tres tiradas de `rng`. `kinds` limita los eventos posibles (desafío diario: DAILY_EVENTS).
 */
export function pickRoomEvent(floor: Floor, floorNum: number, rng: () => number, exclude: ReadonlySet<number> = new Set(), biomeTypes: readonly string[] = [], kinds: readonly RoomEventKind[] = ROOM_EVENTS): RoomEvent | null {
  const roll = rng();
  const which = rng();
  const where = rng();
  if (floorNum <= 1 || roll >= EVENT_CHANCE) return null;
  const combat = floor.rooms.filter((r) => r.kind === 'combat' && !exclude.has(r.id) && !(floor.chestRooms ?? []).includes(r.id));
  if (combat.length === 0) return null;
  const ends = combat.filter((r) => Object.keys(r.doors).length === 1);
  const pool = ends.length > 0 ? ends : combat;
  const room = pool[Math.min(pool.length - 1, Math.floor(where * pool.length))];
  return { roomId: room.id, kind: pickEventKind(floorNum, which, biomeTypes, kinds) };
}

// --- Santuario de la Mega Piedra ---

/**
 * La Mega Piedra ya no sale al azar: cada piso tiene EXACTAMENTE una sala dedicada (la que devuelve
 * `pickMegaStoneRoom`) con un altar que la da una vez. Es un evento aparte del «sala sorpresa» del piso: puede haber
 * las dos cosas en el mismo piso, en salas distintas.
 *
 * Las marcas de «ya cogida» van en `eventsDone` (que ya se guarda) con la clave `megaStoneDoneKey`, para no chocar con
 * otros eventos de la misma sala (la forja de la Torre). Así no hace falta tocar RunSave.
 *
 * Desafío diario: sigue usando la lista congelada DAILY_EVENTS para el evento al azar y, además, tiene su santuario
 * (la sala se elige con una semilla propia y SIN alterar las demás tiradas, así el reto del día sale igual que antes
 * salvo por esa sala extra). Torre (una sola sala por piso): el altar aparece en las salas de descanso y de suministros
 * (ver GameScene.towerEnter); en los pisos de combate, minijefe y jefe no, para no romper su estructura.
 */
export const MEGA_STONE_SEED_SALT = 0x3b9aca07;
/** Las claves de `eventsDone` de la Mega Piedra son `MEGA_STONE_DONE_BASE + id de sala` (las salas reales son pocas). */
export const MEGA_STONE_DONE_BASE = 100000;
export const megaStoneDoneKey = (roomId: number): number => MEGA_STONE_DONE_BASE + roomId;

/**
 * Sala del Santuario de la Mega Piedra del piso: determinista por la semilla del piso, nunca la de inicio ni la del
 * jefe (ni secreta, tienda, centro, objeto ni desafío). Prefiere una sala de combate libre (no en `exclude`: minijefe,
 * evento sorpresa, reglas…; ni de cofre ni grande), mejor sin salida; si no hay, cualquier sala de combate; y si
 * tampoco, cualquier sala que no sea de inicio, jefe ni secreta. Solo devuelve null si el piso no tiene otra sala.
 */
export function pickMegaStoneRoom(floor: Floor, seed: number, exclude: ReadonlySet<number> = new Set()): number | null {
  const rng = mulberry32((seed ^ MEGA_STONE_SEED_SALT) >>> 0);
  const x = rng();
  const chests = floor.chestRooms ?? [];
  const base = floor.rooms.filter((r) => r.id !== floor.startId && r.id !== floor.bossId && r.kind !== 'start' && r.kind !== 'boss' && r.kind !== 'secret');
  const combat = base.filter((r) => r.kind === 'combat');
  const free = combat.filter((r) => !exclude.has(r.id) && !chests.includes(r.id) && r.group === undefined);
  const ends = free.filter((r) => Object.keys(r.doors).length === 1);
  const pool = ends.length > 0 ? ends : free.length > 0 ? free : combat.length > 0 ? combat : base;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(x * pool.length))].id;
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
  pool: readonly PassiveItem[] = RANDOM_PASSIVES,
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
// T59: el rival es un entrenador con un equipo de 2-3 Pokémon que salen de uno en uno.
/** Pokémon del equipo: 2 en los dos primeros pisos y 3 desde el tercero. */
export const rivalTeamSize = (floorNum: number): number => (floorNum >= 3 ? 3 : 2);
/** Multiplicador de vida del Pokémon `member` (1, 2, 3…) del equipo: cada uno es más duro que el anterior, y más con el piso. */
export const rivalMemberHpMul = (floorNum: number, member: number): number =>
  1.5 + 0.3 * (Math.max(1, member) - 1) + 0.04 * Math.min(10, Math.max(1, floorNum));
/** Nombres inventados: «<título> <nombre>». */
export const RIVAL_TITLES: readonly string[] = ['Joven', 'Excursionista', 'Cazabichos', 'Campista', 'Pescador', 'Corredor', 'Granjero', 'Veterano'];
export const RIVAL_NAMES: readonly string[] = ['Marcos', 'Lucía', 'Íker', 'Noa', 'Hugo', 'Sara', 'Leo', 'Irene', 'Pablo', 'Claudia'];
export const rivalTrainerName = (rng: () => number): string =>
  `${RIVAL_TITLES[Math.floor(rng() * RIVAL_TITLES.length) % RIVAL_TITLES.length]} ${RIVAL_NAMES[Math.floor(rng() * RIVAL_NAMES.length) % RIVAL_NAMES.length]}`;
/**
 * Equipo del rival: `size` Pokémon sacados de `pool` (las especies del piso, que ya salen de su bioma), sin repetir
 * mientras haya bastantes; si hay menos especies que huecos, se repiten. Sin especies, equipo vacío.
 */
export function pickRivalTeam<T>(pool: readonly T[], size: number, rng: () => number): T[] {
  const left = [...pool];
  const team: T[] = [];
  for (let k = 0; k < size && pool.length > 0; k++) {
    if (left.length === 0) left.push(...pool);
    const i = Math.min(left.length - 1, Math.floor(rng() * left.length));
    team.push(left.splice(i, 1)[0]);
  }
  return team;
}
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
