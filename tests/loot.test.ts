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
      else berries++;
    }
  }
  assert.ok(coins > 500 && coins < 900, `monedas ${coins}`);
  assert.ok(berries > 150 && berries < 400, `bayas ${berries}`);
});

test('limpiar sala da de 1 a 3 monedas, más en pisos hondos', () => {
  assert.equal(roomClearCoins(() => 0, 1), 1);
  assert.equal(roomClearCoins(() => 0.999, 1), 3);
  assert.equal(roomClearCoins(() => 0, 5), 3);
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
