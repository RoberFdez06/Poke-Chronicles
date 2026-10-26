// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BERRIES,
  POTIONS,
  SHOP_PRICES,
  canBuy,
  canHeal,
  centerHeal,
  healed,
  rollEnemyLoot,
  rollShop,
  roomClearCoins,
} from '../src/data/loot.ts';
import { toMovePower } from '../src/data/items.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('las bayas y pociones curan lo que dicen sin pasar del máximo', () => {
  assert.equal(BERRIES.aranja.heal, 20);
  assert.equal(BERRIES.zidra.heal, 40);
  assert.equal(POTIONS.pocion.heal, 20);
  assert.equal(POTIONS.superpocion.heal, 50);
  assert.equal(healed(50, 100, 20), 70);
  assert.equal(healed(90, 100, 40), 100);
  assert.ok(canHeal(99, 100));
  assert.ok(!canHeal(100, 100));
  assert.equal(centerHeal(100), 50);
  assert.equal(centerHeal(141), 71);
});

test('el jefe siempre suelta una Baya Zidra', () => {
  for (let i = 0; i < 20; i++) {
    const loot = rollEnemyLoot(mulberry32(i), true);
    assert.ok(loot.some((d) => d.kind === 'berry' && d.id === 'zidra'));
  }
});

test('los enemigos a veces sueltan monedas y bayas', () => {
  const rng = mulberry32(5);
  let coins = 0;
  let berries = 0;
  for (let i = 0; i < 2000; i++) {
    for (const d of rollEnemyLoot(rng)) {
      if (d.kind === 'coin') coins++;
      else if (d.kind === 'berry') berries++;
    }
  }
  // T32: 8 % de monedas; T25: 1,7 % de bayas por enemigo
  assert.ok(coins > 110 && coins < 220, `monedas ${coins}`);
  assert.ok(berries > 15 && berries < 60, `bayas ${berries}`);
});

test('limpiar sala da 0 o 1 moneda (T32)', () => {
  assert.equal(roomClearCoins(() => 0, 1), 1);
  assert.equal(roomClearCoins(() => 0.999, 1), 0);
  assert.equal(roomClearCoins(() => 0, 5), 1);
});

test('la tienda tiene poción, superpoción y un objeto', () => {
  const move = toMovePower({ id: 52, name: 'Ascuas', type: 'fire', power: 40 });
  const pool = [move];
  const shop = rollShop(() => 0, new Set(), pool);
  assert.equal(shop.length, 3);
  assert.deepEqual(shop[0].goods, { kind: 'potion', id: 'pocion' });
  assert.deepEqual(shop[1].goods, { kind: 'potion', id: 'superpocion' });
  assert.equal(shop[2].goods.kind, 'move');
  assert.equal(pool.length, 0);
  assert.equal(shop[2].price, SHOP_PRICES.item);
  const passive = rollShop(() => 0.9, new Set(), []);
  assert.equal(passive[2].goods.kind, 'passive');
});

test('no se compra sin monedas, agotado o (pociones) con la vida llena', () => {
  const [pocion, , item] = rollShop(() => 0.9, new Set(), []);
  assert.equal(canBuy(pocion, 4, 50, 100), 'poor');
  assert.equal(canBuy(pocion, 5, 50, 100), 'ok');
  assert.equal(canBuy(pocion, 99, 100, 100), 'full');
  assert.equal(canBuy(item, 99, 100, 100), 'ok');
  assert.equal(canBuy({ ...item, sold: true }, 99, 50, 100), 'sold');
});

import { BOMB, CHALLENGE_WAVES, challengeWaveSize, inBlast, rollChest } from '../src/data/loot.ts';

test('los cofres dan un objeto, monedas o bayas y una bomba', () => {
  const kinds = new Set<string>();
  const rng = mulberry32(9);
  for (let i = 0; i < 300; i++) {
    const c = rollChest(rng);
    if (c.kind === 'item') kinds.add('item');
    else for (const d of c.drops) kinds.add(d.kind);
  }
  assert.deepEqual([...kinds].sort(), ['berry', 'bomb', 'coin', 'item']);
});

test('llaves y bombas caen a veces de los enemigos', () => {
  const rng = mulberry32(3);
  let keys = 0;
  let bombs = 0;
  for (let i = 0; i < 4000; i++) {
    for (const d of rollEnemyLoot(rng)) {
      if (d.kind === 'key') keys++;
      if (d.kind === 'bomb') bombs++;
    }
  }
  assert.ok(keys > 70 && keys < 200, `llaves ${keys}`);
  assert.ok(bombs > 70 && bombs < 200, `bombas ${bombs}`);
});

test('la explosión alcanza lo que está dentro del radio', () => {
  assert.ok(inBlast(0, 0, BOMB.radius, 0));
  assert.ok(!inBlast(0, 0, BOMB.radius + 1, 0));
  assert.ok(inBlast(0, 0, 30, 30, 50));
});

test('las oleadas del desafío crecen', () => {
  assert.equal(CHALLENGE_WAVES, 3);
  assert.ok(challengeWaveSize(1, 3) > challengeWaveSize(1, 1));
  assert.ok(challengeWaveSize(4, 1) > challengeWaveSize(1, 1));
  assert.ok(challengeWaveSize(99, 99) <= 9);
});

test('T49: pociones en el suelo: caen a veces y se llevan como mucho tres', async () => {
  const { rollEnemyLoot, canCarryPotion, MAX_POTIONS, CARRIED_POTION_HEAL, LOOT_CHANCE } = await import('../src/data/loot.ts');
  const { mulberry32 } = await import('../src/level/floorGen.ts');
  const rng = mulberry32(21);
  let n = 0;
  const runs = 20000;
  for (let i = 0; i < runs; i++) if (rollEnemyLoot(rng).some((d) => d.kind === 'potion')) n++;
  assert.ok(Math.abs(n / runs - LOOT_CHANCE.potion) < 0.004, `${n / runs}`);
  assert.ok(rollEnemyLoot(rng, true).every((d) => d.kind !== 'potion'));
  assert.equal(MAX_POTIONS, 3);
  assert.ok(canCarryPotion(MAX_POTIONS - 1));
  assert.ok(!canCarryPotion(MAX_POTIONS));
  assert.ok(CARRIED_POTION_HEAL > 0);
});

// --- La Mega Piedra no sale al azar (solo en su santuario) ---
import { MEGA_STONE_ID } from '../src/data/powerForm.ts';
import { PASSIVE_ITEMS, RANDOM_PASSIVES, NON_RANDOM_PASSIVES, pickPassive, rollItem as rollItemMega } from '../src/data/items.ts';
import { rollShop as rollShopMega } from '../src/data/loot.ts';
import { merchantStock as merchantStockMega } from '../src/level/roomEvents.ts';
import { fuseResult } from '../src/data/forge.ts';

test('Mega Piedra: sigue siendo un pasivo válido pero queda fuera de los sorteos al azar', () => {
  assert.ok(PASSIVE_ITEMS.some((i) => i.id === MEGA_STONE_ID));
  assert.ok(NON_RANDOM_PASSIVES.has(MEGA_STONE_ID));
  assert.ok(!RANDOM_PASSIVES.some((i) => i.id === MEGA_STONE_ID));
  assert.equal(RANDOM_PASSIVES.length, PASSIVE_ITEMS.length - NON_RANDOM_PASSIVES.size);
});

test('Mega Piedra: nunca sale en cofres/suelo, tienda, mercader ni forja con los sorteos por defecto', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 3000; seed++) {
    const rng = mulberry32(seed);
    const drop = rollItemMega(rng, new Set(), [], 0, [], undefined, 1 + (seed % 9));
    if (drop.kind === 'passive') seen.add(drop.item.id);
    for (const s of rollShopMega(mulberry32(seed), new Set(), [], undefined, 1 + (seed % 9))) if (s.goods.kind === 'passive') seen.add(s.goods.id);
    for (const s of merchantStockMega(mulberry32(seed), new Set(), [])) if (s.goods.kind === 'passive') seen.add(s.goods.id);
    assert.notEqual(pickPassive(mulberry32(seed), RANDOM_PASSIVES).id, MEGA_STONE_ID);
  }
  assert.ok(!seen.has(MEGA_STONE_ID));
  assert.ok(seen.size > 20); // el sorteo sigue funcionando con el resto
  // Forja: fusionar dos objetos no da la Mega Piedra
  const ids = RANDOM_PASSIVES.slice(0, 40).map((i) => i.id);
  for (let a = 0; a + 1 < ids.length; a++) for (let seed = 1; seed <= 20; seed++) {
    const r = fuseResult(ids[a], ids[a + 1], [ids[a], ids[a + 1]], mulberry32(seed));
    assert.notEqual(r?.id, MEGA_STONE_ID);
  }
});
