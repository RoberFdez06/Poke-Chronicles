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
