// Ejecutar con `npm test`. T72 (cierre): tienda sin repetidos, lote del punto de control y sitios del descanso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/level/floorGen.ts';
import { RANDOM_PASSIVES, passiveRarity } from '../src/data/items.ts';
import { itemSlots } from '../src/data/forge.ts';
import { isLastStage } from '../src/data/modes.ts';
import { towerFloorKind, SUPPLY_CHOICES } from '../src/level/tower.ts';
import {
  boxesOverlap, isTowerFinale, TOWER_KIT_MAX, towerCheckpointKit, towerRestBoxes, towerShopOffer,
} from '../src/level/towerExtras.ts';

const shop = (seed: number, owned: Iterable<string>, sold: Iterable<number> = []) =>
  towerShopOffer(mulberry32(seed), RANDOM_PASSIVES, new Set(owned), new Set(sold));

test('T72: la tienda del descanso nunca vende algo que ya llevas', () => {
  for (let seed = 1; seed < 40; seed++) {
    const base = shop(seed, []);
    assert.equal(base.length, 3);
    assert.ok(base[2].exclusive && passiveRarity(base[2].goods.kind === 'passive' ? base[2].goods.id : '') === 'legendary');
    const owned = base.map((o) => (o.goods.kind === 'passive' ? o.goods.id : ''));
    const again = shop(seed, owned);
    assert.equal(again.length, 3);
    for (const o of again) assert.ok(o.goods.kind === 'passive' && !owned.includes(o.goods.id));
  }
});

test('T72: al continuar, lo comprado no se repone ni cambia lo demás', () => {
  for (let seed = 1; seed < 40; seed++) {
    const base = shop(seed, []);
    const bought = base[0];
    const id = bought.goods.kind === 'passive' ? bought.goods.id : '';
    const after = shop(seed, [id], [bought.k]);
    assert.deepEqual(after, base.slice(1));
  }
});

test('T72: empezar en un punto de control da objetos y huecos acordes al piso, con tope', () => {
  const k1 = towerCheckpointKit(1, mulberry32(1), RANDOM_PASSIVES);
  assert.deepEqual(k1, { bosses: 0, passives: [], coins: 0, potions: 0 });
  let prev = 0;
  for (let f = 11; f <= 91; f += 10) {
    const k = towerCheckpointKit(f, mulberry32(f), RANDOM_PASSIVES);
    assert.equal(k.bosses, (f - 1) / 10);
    assert.ok(k.passives.length >= prev && k.passives.length <= TOWER_KIT_MAX);
    assert.ok(k.passives.length <= itemSlots(k.bosses));
    assert.equal(new Set(k.passives).size, k.passives.length);
    assert.ok(k.passives.every((id) => passiveRarity(id) !== 'legendary'));
    assert.ok(k.passives.some((id) => passiveRarity(id) !== 'common'));
    assert.deepEqual(towerCheckpointKit(f, mulberry32(f), RANDOM_PASSIVES), k);
    prev = k.passives.length;
  }
  assert.equal(towerCheckpointKit(51, mulberry32(3), RANDOM_PASSIVES).passives.length, TOWER_KIT_MAX);
});

test('T72: el descanso no pisa el Centro, la forja, la Mega Piedra, el altar, la tienda ni la columna', () => {
  const b = Object.entries(towerRestBoxes());
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++) assert.ok(!boxesOverlap(b[i][1], b[j][1]), `${b[i][0]} pisa ${b[j][0]}`);
});

test('T72: el piso 100 es el reto final y acaba la partida con victoria', () => {
  for (const seed of [1, 7, 99]) assert.equal(towerFloorKind(100, seed), 'final');
  assert.ok(isTowerFinale('tower', 100));
  assert.ok(isLastStage('tower', 100));
  assert.ok(!isLastStage('tower', 99));
});

test('T72: los suministros ofrecen poción, llave y baya', () => {
  assert.deepEqual(SUPPLY_CHOICES.map((c) => c.kind), ['potion', 'key', 'berry']);
});
