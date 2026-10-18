// Recuperar vida y monedas de la partida: bayas, pociones, Centro Pokémon y tienda.
// Las monedas solo valen dentro de la partida (en la tienda) y se pierden al acabarla; los tickets
// (save.ts) son otra cosa y se gastan fuera, en el gacha.
// Lógica pura, sin Phaser ni red, para poder testearla.
import { PASSIVE_ITEMS, type MovePower } from './items.ts';

export type BerryId = 'aranja' | 'zidra';
export type PotionId = 'pocion' | 'superpocion';

export interface HealItem {
  name: string;
  heal: number;
  color: number;
}

export const BERRIES: Readonly<Record<BerryId, HealItem>> = {
  aranja: { name: 'Baya Aranja', heal: 20, color: 0x4f8fe0 },
  zidra: { name: 'Baya Zidra', heal: 40, color: 0xf2d43a },
};

export const POTIONS: Readonly<Record<PotionId, HealItem>> = {
  pocion: { name: 'Poción', heal: 20, color: 0xb070e0 },
  superpocion: { name: 'Superpoción', heal: 50, color: 0xe0608a },
};

/** PS tras curar `amount` sin pasar del máximo. */
export const healed = (hp: number, maxHp: number, amount: number): number => Math.min(maxHp, hp + Math.max(0, amount));

/** Una baya o poción solo se gasta si te falta vida. */
export const canHeal = (hp: number, maxHp: number): boolean => hp < maxHp;

/** El Centro Pokémon cura la mitad de los PS máximos. */
export const centerHeal = (maxHp: number): number => Math.round(maxHp / 2);

// --- Botín de los enemigos ---

/** Lo que cae al suelo y se recoge al pisarlo. */
export type LootDrop = { kind: 'coin'; value: number } | { kind: 'berry'; id: BerryId };

export const LOOT_CHANCE = {
  coin: 0.35,
  /** De las monedas que caen, cuántas son de 5. */
  bigCoin: 0.12,
  aranja: 0.1,
  zidra: 0.03,
} as const;

/** Botín de un enemigo al caer. El jefe siempre suelta una Baya Zidra y un puñado de monedas. */
export function rollEnemyLoot(rng: () => number, boss = false): LootDrop[] {
  if (boss) return [{ kind: 'berry', id: 'zidra' }, { kind: 'coin', value: 5 }, { kind: 'coin', value: 5 }];
  const out: LootDrop[] = [];
  if (rng() < LOOT_CHANCE.coin) out.push({ kind: 'coin', value: rng() < LOOT_CHANCE.bigCoin ? 5 : 1 });
  const b = rng();
  if (b < LOOT_CHANCE.zidra) out.push({ kind: 'berry', id: 'zidra' });
  else if (b < LOOT_CHANCE.zidra + LOOT_CHANCE.aranja) out.push({ kind: 'berry', id: 'aranja' });
  return out;
}

/** Monedas que caen al limpiar una sala: de 1 a 3, una más cada dos pisos. */
export function roomClearCoins(rng: () => number, floor: number): number {
  return 1 + Math.floor(rng() * 3) + Math.floor((Math.max(1, floor) - 1) / 2);
}

// --- Tienda ---

/** Lo que vende la tienda: una poción o un objeto como los del suelo (pasivo por id o poder). */
export type ShopGoods =
  | { kind: 'potion'; id: PotionId }
  | { kind: 'passive'; id: string }
  | { kind: 'move'; move: MovePower };

export interface ShopSlot {
  goods: ShopGoods;
  price: number;
  sold: boolean;
}

export const SHOP_PRICES = { pocion: 5, superpocion: 12, item: 15 } as const;

/**
 * Los 3 artículos de la tienda: Poción, Superpoción y un pasivo o un poder al azar.
 * El poder sale (y se quita) de `movePool`, como los objetos del suelo; los pasivos evitan los que ya tienes.
 */
export function rollShop(rng: () => number, ownedPassives: ReadonlySet<string>, movePool: MovePower[]): ShopSlot[] {
  let goods: ShopGoods;
  if (movePool.length > 0 && rng() < 0.5) {
    const [move] = movePool.splice(Math.floor(rng() * movePool.length), 1);
    goods = { kind: 'move', move };
  } else {
    const fresh = PASSIVE_ITEMS.filter((i) => !ownedPassives.has(i.id));
    const list = fresh.length > 0 ? fresh : PASSIVE_ITEMS;
    goods = { kind: 'passive', id: list[Math.floor(rng() * list.length)].id };
  }
  return [
    { goods: { kind: 'potion', id: 'pocion' }, price: SHOP_PRICES.pocion, sold: false },
    { goods: { kind: 'potion', id: 'superpocion' }, price: SHOP_PRICES.superpocion, sold: false },
    { goods, price: SHOP_PRICES.item, sold: false },
  ];
}

export type BuyResult = 'ok' | 'sold' | 'poor' | 'full';

/**
 * ¿Se puede comprar? Agotado, sin monedas suficientes o (las pociones) con los PS al máximo.
 * Si sí, devuelve 'ok' y quien llama descuenta el precio y marca el artículo como vendido.
 */
export function canBuy(slot: ShopSlot, coins: number, hp: number, maxHp: number): BuyResult {
  if (slot.sold) return 'sold';
  if (coins < slot.price) return 'poor';
  if (slot.goods.kind === 'potion' && !canHeal(hp, maxHp)) return 'full';
  return 'ok';
}
