// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTakePassive, distinctPassives, forgeWeight, fuse, fuseCost, fuseProblem, fusePartners, fuseResult, itemSlots,
  nextRarity, recycle, recycleCoins, removePassive, slotsLabel, takesSlot, usedSlots,
} from '../src/data/forge.ts';
import { ITEM_SLOTS_BASE, ITEM_SLOTS_MAX, PASSIVE_ITEMS, passivePrice, passiveRarity } from '../src/data/items.ts';
import { eventWeights } from '../src/level/roomEvents.ts';

const ofRarity = (r: string) => PASSIVE_ITEMS.filter((i) => passiveRarity(i.id) === r).map((i) => i.id);
const commons = ofRarity('common');
const rares = ofRarity('rare');

test('huecos: 10 al empezar, +1 por jefe, tope 16', () => {
  assert.equal(itemSlots(0), ITEM_SLOTS_BASE);
  assert.equal(itemSlots(3), 13);
  assert.equal(itemSlots(6), 16);
  assert.equal(itemSlots(40), ITEM_SLOTS_MAX);
  assert.equal(itemSlots(-2), 10);
});

test('las copias ocupan un solo hueco', () => {
  const p = ['lupa', 'lupa', 'vidasfera'];
  assert.equal(usedSlots(p), 2);
  assert.equal(slotsLabel(p, 0), '2/10');
  assert.equal(takesSlot('lupa', p), false);
  assert.equal(takesSlot('garra-rapida', p), true);
  assert.deepEqual(distinctPassives(p), ['lupa', 'vidasfera']);
});

test('con los huecos llenos solo caben copias; con más de la cuenta no se quita nada', () => {
  const full = Array.from({ length: 10 }, (_, i) => `obj-${i}`);
  assert.equal(canTakePassive('nuevo', full, 0), false);
  assert.equal(canTakePassive('obj-3', full, 0), true);
  assert.equal(canTakePassive('nuevo', full, 1), true);
  const over = Array.from({ length: 13 }, (_, i) => `obj-${i}`);
  assert.equal(canTakePassive('nuevo', over, 0), false);
  assert.equal(usedSlots(over), 13);
  assert.deepEqual(removePassive(['a', 'b', 'a'], 'a'), ['b']);
});

test('reciclar: quita todas las copias y da monedas según rareza y copias', () => {
  const id = commons[0];
  const one = recycleCoins(id, [id]);
  assert.ok(one >= 1 && one < passivePrice(id));
  assert.equal(recycleCoins(id, [id, id]), one * 2);
  const r = recycle([id, 'x', id], id);
  assert.deepEqual(r.passives, ['x']);
  assert.equal(r.coins, one * 2);
  assert.deepEqual(recycle(['x'], id), { passives: ['x'], coins: 0 });
  assert.ok(recycleCoins(ofRarity('legendary')[0], ['?']) > recycleCoins(commons[0], ['?']));
});

test('fusionar: distintos, misma rareza y nunca legendarios', () => {
  const [a, b] = commons;
  const p = [a, b, rares[0]];
  assert.equal(fuseProblem(a, b, p), null);
  assert.ok(fuseProblem(a, a, p));
  assert.ok(fuseProblem(a, rares[0], p));
  assert.ok(fuseProblem(a, commons[2], p)); // no lo llevas
  const [l1, l2] = ofRarity('legendary');
  assert.ok(fuseProblem(l1, l2, [l1, l2]));
  assert.equal(nextRarity('common'), 'rare');
  assert.equal(nextRarity('legendary'), null);
  assert.deepEqual(fusePartners(a, p), [b]);
  assert.ok(fuseCost(a) > 0);
});

test('el resultado es de la rareza siguiente y no uno que ya tengas si hay otros', () => {
  const [a, b] = commons;
  for (let k = 0; k < 20; k++) {
    const owned = [a, b, rares[0], rares[1]];
    const res = fuseResult(a, b, owned, () => k / 20)!;
    assert.equal(passiveRarity(res.id), 'rare');
    assert.ok(!owned.includes(res.id), res.id);
  }
  // Si llevas todos los de la rareza siguiente, sale uno cualquiera de ella
  const res = fuseResult(a, b, [a, b, ...rares], () => 0.5)!;
  assert.equal(passiveRarity(res.id), 'rare');
  // Mismo azar, mismo resultado (se enseña antes de aceptar)
  assert.equal(fuseResult(a, b, [a, b], () => 0.3)?.id, fuseResult(a, b, [a, b], () => 0.3)?.id);
  assert.equal(fuseResult(a, a, [a], () => 0.3), null);
});

test('la fusión gasta una copia de cada uno y ocupa un solo hueco', () => {
  const [a, b] = commons;
  const after = fuse([a, a, b, 'x'], a, b, 'nuevo');
  assert.deepEqual(after, [a, 'x', 'nuevo']);
  assert.equal(usedSlots(fuse([a, b], a, b, 'nuevo')), 1);
});

test('la forja no sale al principio y es más probable cuanto más hondo', () => {
  assert.equal(forgeWeight(1), 0);
  assert.equal(forgeWeight(2), 0);
  assert.ok(forgeWeight(3) > 0);
  assert.ok(forgeWeight(8) > forgeWeight(4));
  assert.equal(eventWeights(9).forge, forgeWeight(9));
});
