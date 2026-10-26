// Recuperar vida y monedas de la partida: bayas, pociones, Centro Pokémon y tienda.
// Las monedas solo valen dentro de la partida (en la tienda) y se pierden al acabarla; los tickets
// (save.ts) son otra cosa y se gastan fuera, en el gacha.
// Lógica pura, sin Phaser ni red, para poder testearla.
import { RANDOM_PASSIVES, takeMoveByRarity, type MovePower, type PassiveItem, passivePrice } from './items.ts';

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
export type LootDrop = { kind: 'coin'; value: number } | { kind: 'berry'; id: BerryId } | { kind: 'key' } | { kind: 'bomb' } | { kind: 'potion' };

export const LOOT_CHANCE = {
  // T32: bastante menos (antes 35 % de monedas, 10 % + 3 % de bayas y 5 % de llaves y bombas).
  // T25: bayas algo menos raras (eran 0,8 % + 0,2 %): siguen siendo 1-2 por piso, ver scripts/simulate.ts
  coin: 0.08,
  /** De las monedas que caen, cuántas son de 5. */
  bigCoin: 0.12,
  aranja: 0.013,
  zidra: 0.004,
  key: 0.03,
  bomb: 0.03,
  /** T49: poción que se guarda (como las bombas) y se usa cuando quieras. */
  potion: 0.012,
} as const;

/** Pociones que puedes llevar a la vez y lo que cura cada una (T49). */
export const MAX_POTIONS = 3;
export const CARRIED_POTION_HEAL = 30;
/** ¿Se puede coger otra poción? (si no, se queda en el suelo) */
export const canCarryPotion = (potions: number): boolean => potions < MAX_POTIONS;

/** Botín de un enemigo al caer. El jefe siempre suelta una Baya Zidra y un puñado de monedas. */
export function rollEnemyLoot(rng: () => number, boss = false): LootDrop[] {
  if (boss) return [{ kind: 'berry', id: 'zidra' }, { kind: 'coin', value: 5 }];
  const out: LootDrop[] = [];
  if (rng() < LOOT_CHANCE.coin) out.push({ kind: 'coin', value: rng() < LOOT_CHANCE.bigCoin ? 5 : 1 });
  const b = rng();
  if (b < LOOT_CHANCE.zidra) out.push({ kind: 'berry', id: 'zidra' });
  else if (b < LOOT_CHANCE.zidra + LOOT_CHANCE.aranja) out.push({ kind: 'berry', id: 'aranja' });
  if (rng() < LOOT_CHANCE.key) out.push({ kind: 'key' });
  if (rng() < LOOT_CHANCE.bomb) out.push({ kind: 'bomb' });
  if (rng() < LOOT_CHANCE.potion) out.push({ kind: 'potion' });
  return out;
}

// --- Cofres, bombas y sala de desafío (T21) ---

/** Lo que hay en un cofre: un objeto (pasivo o poder), un puñado de monedas, o bayas y una bomba. */
export type ChestPrize = { kind: 'item' } | { kind: 'loot'; drops: LootDrop[] };

export function rollChest(rng: () => number): ChestPrize {
  const x = rng();
  if (x < 0.35) return { kind: 'item' };
  if (x < 0.7) {
    const n = 3 + Math.floor(rng() * 4);
    return { kind: 'loot', drops: Array.from({ length: n }, () => ({ kind: 'coin' as const, value: rng() < 0.2 ? 5 : 1 })) };
  }
  return { kind: 'loot', drops: [{ kind: 'berry', id: rng() < 0.5 ? 'aranja' : 'zidra' }, { kind: 'bomb' }] };
}

/** Con cuántas bombas y llaves empiezas (como en Isaac: una bomba, ninguna llave). */
export const START_BOMBS = 1;
export const START_KEYS = 0;

/** Bomba: tarda en estallar, alcance (px), daño a enemigos y a ti si te pilla. */
export const BOMB = { fuse: 1300, radius: 110, damage: 60, selfDamage: 12 } as const;

/** ¿Alcanza la explosión en (bx, by) a algo en (x, y)? */
export const inBlast = (bx: number, by: number, x: number, y: number, radius: number = BOMB.radius): boolean =>
  (x - bx) ** 2 + (y - by) ** 2 <= radius ** 2;

/** Sala de desafío: tres oleadas cada vez más grandes. */
export const CHALLENGE_WAVES = 3;
export const challengeWaveSize = (floor: number, wave: number): number =>
  Math.min(9, 2 + Math.max(1, Math.floor(floor)) + Math.max(1, Math.floor(wave)));

/** Premio de la sala de desafío: un objeto, monedas, una llave y una baya Zidra. */
export const CHALLENGE_REWARD: readonly LootDrop[] = [
  { kind: 'coin', value: 5 },
  { kind: 'coin', value: 5 },
  { kind: 'key' },
  { kind: 'berry', id: 'zidra' },
];

/** Monedas que caen al limpiar una sala: 0 o 1 (dos de cada tres veces una). T32: antes de 1 a 3, y más en pisos hondos. */
export function roomClearCoins(rng: () => number, _floor: number): number {
  return rng() < 2 / 3 ? 1 : 0;
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
export function rollShop(
  rng: () => number,
  ownedPassives: ReadonlySet<string>,
  movePool: MovePower[],
  /** Pasivos que pueden salir (sin los bloqueados por logros). */
  pool: readonly PassiveItem[] = RANDOM_PASSIVES,
  floor = 1,
): ShopSlot[] {
  let goods: ShopGoods;
  if (movePool.length > 0 && rng() < 0.5) {
    goods = { kind: 'move', move: takeMoveByRarity(rng, movePool, floor) };
  } else {
    const fresh = pool.filter((i) => !ownedPassives.has(i.id));
    const list = fresh.length > 0 ? fresh : pool;
    goods = { kind: 'passive', id: list[Math.floor(rng() * list.length)].id };
  }
  return [
    { goods: { kind: 'potion', id: 'pocion' }, price: SHOP_PRICES.pocion, sold: false },
    { goods: { kind: 'potion', id: 'superpocion' }, price: SHOP_PRICES.superpocion, sold: false },
    // T52: los pasivos cuestan según su rareza; los poderes, lo de siempre
    { goods, price: goods.kind === 'passive' ? passivePrice(goods.id) : SHOP_PRICES.item, sold: false },
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

/** Probabilidad de que una sala de combate limpiada deje un objeto. */
export const CLEAR_DROP_CHANCE = 0.25;
