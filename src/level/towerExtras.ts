// T72 (segunda parte): lógica pura de la Torre que usa GameScene: altar y tienda del descanso, objeto épico del
// minijefe, resbalón en el hielo, reto final en el piso 100 y la lista de puntos de control. Sin Phaser, con tests.
import { passiveRarity, passivePrice, type PassiveItem } from '../data/items.ts';
import type { ShopSlot } from '../data/loot.ts';
import { TOWER_FLOORS, TOWER_SEGMENT, towerCheckpoint, towerCheckpointCost } from './tower.ts';

/** Objetos del altar del descanso (se coge uno y los demás desaparecen). */
export const TOWER_ALTAR_COUNT = 3;
/** Parte del precio que se paga en la tienda del descanso (descuento del 30 %). */
export const TOWER_SHOP_DISCOUNT = 0.7;
/** El hielo: cuánto se acerca tu velocidad a la que pides en cada fotograma de 60 fps (poco = resbala mucho). */
export const ICE_GRIP = 0.06;

const pickFrom = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length];

/** Pasivos sin repetir (frescos primero; si no quedan, de toda la bolsa). */
function freshList(pool: readonly PassiveItem[], owned: ReadonlySet<string>, used: ReadonlySet<string>): readonly PassiveItem[] {
  const fresh = pool.filter((i) => !owned.has(i.id) && !used.has(i.id));
  if (fresh.length > 0) return fresh;
  const notUsed = pool.filter((i) => !used.has(i.id));
  return notUsed.length > 0 ? notUsed : pool;
}

/** Tres objetos distintos para el altar; al menos uno raro o mejor. */
export function towerAltarItems(rng: () => number, owned: ReadonlySet<string>, pool: readonly PassiveItem[]): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  // El primero, raro o mejor (si la bolsa lo permite)
  const good = freshList(pool, owned, used).filter((i) => passiveRarity(i.id) !== 'common');
  const first = pickFrom(rng, good.length > 0 ? good : freshList(pool, owned, used));
  out.push(first.id);
  used.add(first.id);
  while (out.length < TOWER_ALTAR_COUNT && used.size < pool.length) {
    const it = pickFrom(rng, freshList(pool, owned, used));
    out.push(it.id);
    used.add(it.id);
  }
  // Orden barajado para que el bueno no salga siempre a la izquierda
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [out[k], out[j]] = [out[j], out[k]];
  }
  return out;
}

export const discounted = (price: number): number => Math.max(1, Math.round(price * TOWER_SHOP_DISCOUNT));

/**
 * Tienda del descanso: dos objetos con descuento y uno exclusivo (legendario, solo se vende aquí) también rebajado.
 * `avoid` = objetos que ya están en el altar, para no repetir. El exclusivo va el último.
 */
export function towerShopStock(rng: () => number, owned: ReadonlySet<string>, pool: readonly PassiveItem[], avoid: ReadonlySet<string> = new Set()): (ShopSlot & { exclusive: boolean })[] {
  const used = new Set(avoid);
  const out: (ShopSlot & { exclusive: boolean })[] = [];
  const legend = freshList(pool, owned, used).filter((i) => passiveRarity(i.id) === 'legendary');
  const anyLegend = pool.filter((i) => passiveRarity(i.id) === 'legendary' && !used.has(i.id));
  const ex = legend.length > 0 ? pickFrom(rng, legend) : anyLegend.length > 0 ? pickFrom(rng, anyLegend) : undefined;
  if (ex) used.add(ex.id);
  for (let k = 0; k < 2 && used.size < pool.length; k++) {
    const list = freshList(pool, owned, used).filter((i) => passiveRarity(i.id) !== 'legendary');
    const it = pickFrom(rng, list.length > 0 ? list : freshList(pool, owned, used));
    used.add(it.id);
    out.push({ goods: { kind: 'passive', id: it.id }, price: discounted(passivePrice(it.id)), sold: false, exclusive: false });
  }
  if (ex) out.push({ goods: { kind: 'passive', id: ex.id }, price: discounted(passivePrice(ex.id)), sold: false, exclusive: true });
  return out;
}

/** Objeto épico que suelta el minijefe de la Torre (si no hay épicos en la bolsa, el mejor que haya). */
export function towerMinibossItem(rng: () => number, owned: ReadonlySet<string>, pool: readonly PassiveItem[]): string {
  const order = ['epic', 'legendary', 'rare', 'common'] as const;
  for (const r of order) {
    const fresh = pool.filter((i) => passiveRarity(i.id) === r && !owned.has(i.id));
    if (fresh.length > 0) return pickFrom(rng, fresh).id;
  }
  const epic = pool.filter((i) => passiveRarity(i.id) === 'epic');
  return pickFrom(rng, epic.length > 0 ? epic : pool).id;
}

/** El piso 100 de la Torre es el reto final (trío o gigante de finale.ts). */
export const isTowerFinale = (mode: string, floor: number): boolean => mode === 'tower' && floor === TOWER_FLOORS;

/**
 * Velocidad sobre hielo: se acerca poco a poco a la que pides (inercia), sin pasarse.
 * `dtMs` = duración del fotograma; con dt 0 no cambia nada.
 */
export function iceVelocity(cur: { x: number; y: number }, want: { x: number; y: number }, dtMs: number): { x: number; y: number } {
  const frames = Math.max(0, Math.min(dtMs, 100)) / (1000 / 60);
  const k = 1 - Math.pow(1 - ICE_GRIP, frames);
  return { x: cur.x + (want.x - cur.x) * k, y: cur.y + (want.y - cur.y) * k };
}

export interface TowerCheckpointOption {
  floor: number;
  cost: number;
}

/** Puntos de control para empezar: el piso 1 (gratis) y el descanso tras cada jefe vencido hasta tu récord. */
export function towerCheckpointOptions(bestFloor: number): TowerCheckpointOption[] {
  const top = towerCheckpoint(bestFloor);
  const out: TowerCheckpointOption[] = [];
  for (let f = 1; f <= top; f += TOWER_SEGMENT) {
    out.push({ floor: f, cost: towerCheckpointCost(f) });
  }
  return out;
}

// --- T72 (cierre): tienda sin repetidos, lote del punto de control y sitios del descanso ---

/** Base (en eventsDone) de lo vendido en la tienda del descanso: TOWER_SHOP_SOLD + n.º de candidato. */
export const TOWER_SHOP_SOLD = 201000;

export interface TowerShopOffer extends ShopSlot {
  exclusive: boolean;
  /** N.º fijo del candidato (para apuntar lo vendido; no cambia al continuar). */
  k: number;
}

/**
 * Tienda del descanso que nunca vende algo que ya llevas. Los candidatos salen siempre en el mismo orden (barajado con
 * la semilla, sin mirar lo que llevas), así que lo vendido se reconoce al continuar por su n.º. Se eligen los dos
 * primeros normales y el primer legendario que no lleves o que ya se hayan vendido aquí (estos ocupan su sitio pero no
 * se muestran: la tienda no se rellena tras comprar). Devuelve solo lo que queda a la venta.
 */
export function towerShopOffer(rng: () => number, pool: readonly PassiveItem[], owned: ReadonlySet<string>, sold: ReadonlySet<number>): TowerShopOffer[] {
  const order = pool.map((i) => i.id);
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  const take = (legend: boolean, n: number) => {
    const out: number[] = [];
    for (let k = 0; k < order.length && out.length < n; k++) {
      if ((passiveRarity(order[k]) === 'legendary') !== legend) continue;
      if (sold.has(k) || !owned.has(order[k])) out.push(k);
    }
    return out;
  };
  const picks = [...take(false, 2).map((k) => ({ k, exclusive: false })), ...take(true, 1).map((k) => ({ k, exclusive: true }))];
  return picks
    .filter((p) => !sold.has(p.k))
    .map((p) => ({ k: p.k, exclusive: p.exclusive, goods: { kind: 'passive' as const, id: order[p.k] }, price: discounted(passivePrice(order[p.k])), sold: false }));
}

/** Lote al empezar desde un punto de control: dos objetos por jefe que te saltas, como mucho este número. */
export const TOWER_KIT_PER_BOSS = 2;
export const TOWER_KIT_MAX = 8;
export const TOWER_KIT_COINS_PER_BOSS = 15;
export const TOWER_KIT_POTIONS_MAX = 3;

export interface TowerKit {
  /** Jefes que cuentan como vencidos (dan sus huecos de objeto). */
  bosses: number;
  passives: string[];
  coins: number;
  potions: number;
}

/**
 * Lo que te llevas al empezar en el piso `floor` (un descanso 11, 21…): huecos de los jefes saltados, un lote de
 * objetos distintos (nunca legendarios; uno raro o mejor por cada tres), monedas y pociones. Piso 1: nada.
 */
export function towerCheckpointKit(floor: number, rng: () => number, pool: readonly PassiveItem[]): TowerKit {
  const bosses = Math.max(0, Math.floor((Math.min(TOWER_FLOORS, floor) - 1) / TOWER_SEGMENT));
  const want = Math.min(TOWER_KIT_MAX, bosses * TOWER_KIT_PER_BOSS);
  const noLegend = pool.filter((i) => passiveRarity(i.id) !== 'legendary');
  const used = new Set<string>();
  const passives: string[] = [];
  for (let n = 0; n < want; n++) {
    const left = noLegend.filter((i) => !used.has(i.id));
    if (left.length === 0) break;
    const good = left.filter((i) => passiveRarity(i.id) !== 'common');
    const list = n % 3 === 0 && good.length > 0 ? good : left;
    const it = pickFrom(rng, list);
    used.add(it.id);
    passives.push(it.id);
  }
  return { bosses, passives, coins: bosses * TOWER_KIT_COINS_PER_BOSS, potions: Math.min(TOWER_KIT_POTIONS_MAX, Math.ceil(bosses / 3)) };
}

/** Rectángulo respecto al centro de la sala (x, y = esquina de arriba a la izquierda). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Sitios del descanso y los suministros respecto al centro de la sala (800 x 480: x de -400 a 400, y de -240 a 240).
 * El Centro Pokémon (mostrador, alfombra y NPC) lo pone buildCenter en (0, -60); lo demás va alrededor sin pisarlo.
 */
export const TOWER_REST_LAYOUT = {
  /** Forja (dibujo en el centro y botones a ±90, 70 más abajo). */
  forge: { x: -250, y: 60 },
  /** Altar de la Mega Piedra. */
  mega: { x: 290, y: -40 },
  /** Primer objeto del altar de 3 y paso entre ellos; la base va debajo. */
  altar: { x: -270, y: 200, step: 100 },
  /** Primer artículo de la tienda y paso; el título encima y el puesto debajo. */
  shop: { x: 80, y: 140, step: 100 },
  /** Columna de luz para subir en los pisos con Centro (en los demás, en el centro). */
  column: { x: 0, y: 175 },
  /** Puesto de la sala de suministros (sin Centro). */
  supply: { x: -150, y: 40 },
} as const;

/** Cajas que ocupa cada cosa del descanso (para comprobar que no se pisan). */
export function towerRestBoxes(): Record<string, Box> {
  const L = TOWER_REST_LAYOUT;
  return {
    mostrador: { x: -124, y: -110, w: 248, h: 102 },
    alfombra: { x: -150, y: -4, w: 300, h: 78 },
    npc: { x: 170 - 18, y: -20 - 18, w: 36, h: 36 },
    bancos: { x: -330, y: -186, w: 660, h: 25 },
    forja: { x: L.forge.x - 70, y: L.forge.y - 56, w: 110, h: 90 },
    botonesForja: { x: L.forge.x - 155, y: L.forge.y + 48, w: 310, h: 44 },
    mega: { x: L.mega.x - 100, y: L.mega.y - 84, w: 200, h: 174 },
    altar: { x: L.altar.x - 30, y: L.altar.y - 28, w: L.altar.step * 2 + 60, h: 64 },
    tienda: { x: L.shop.x - 50, y: L.shop.y - 60, w: L.shop.step * 2 + 100, h: 110 },
    columna: { x: L.column.x - 18, y: L.column.y - 85, w: 36, h: 110 },
  };
}

export const boxesOverlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
