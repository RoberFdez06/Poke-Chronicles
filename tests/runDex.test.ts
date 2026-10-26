import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDexIndex, DEX_CANDIES, parseDefeated, registerDefeat, typeProgress } from '../src/data/runDex.ts';

// Cuatro especies: dos de fuego, una de planta y una mixta (fuego y volador)
const INDEX = [
  { id: 1, types: ['fire'] },
  { id: 2, types: ['fire'] },
  { id: 3, types: ['grass'] },
  { id: 4, types: ['fire', 'flying'] },
];

test('parseDefeated tolera basura y repetidos', () => {
  assert.deepEqual(parseDefeated('xx'), []);
  assert.deepEqual(parseDefeated(null), []);
  assert.deepEqual(parseDefeated('[1,1,2,"a",-3,0,1.5]'), [1, 2]);
});

test('el índice cuenta las especies de dos tipos en los dos', () => {
  const dx = buildDexIndex(INDEX);
  assert.deepEqual(dx.totals, { fire: 3, grass: 1, flying: 1 });
});

test('una especie nueva se anota y la repetida no da nada', () => {
  const dx = buildDexIndex(INDEX);
  const have = new Set<number>();
  assert.equal(registerDefeat(dx, have, 3).isNew, true);
  assert.deepEqual([...have], [3]);
  assert.deepEqual(registerDefeat(dx, have, 3), { isNew: false, rewards: [] });
  assert.deepEqual(registerDefeat(dx, have, 999), { isNew: false, rewards: [] });
});

test('completar un tipo da todos los hitos de golpe si tiene pocas especies', () => {
  const dx = buildDexIndex(INDEX);
  const gain = registerDefeat(dx, new Set(), 3); // la única de planta: 0 -> 100 %
  assert.deepEqual(gain.rewards.map((r) => r.percent), [25, 50, 75, 100]);
  assert.equal(gain.rewards.reduce((n, r) => n + r.candies, 0), 2 + 3 + 5 + 15);
});

test('cada hito se premia una sola vez', () => {
  const dx = buildDexIndex(INDEX);
  const have = new Set<number>();
  const a = registerDefeat(dx, have, 1); // fuego 1/3 = 33 %: cruza el 25
  assert.deepEqual(a.rewards.map((r) => [r.type, r.percent]), [['fire', 25]]);
  const b = registerDefeat(dx, have, 2); // 2/3 = 66 %: cruza el 50
  assert.deepEqual(b.rewards.map((r) => r.percent), [50]);
  const c = registerDefeat(dx, have, 4); // fuego 3/3 = 100 % (cruza 75 y 100) y volador 1/1 (los cuatro)
  const fire = c.rewards.filter((r) => r.type === 'fire').map((r) => r.percent);
  assert.deepEqual(fire, [75, 100]);
  assert.equal(c.rewards.filter((r) => r.type === 'flying').length, 4);
  assert.equal(DEX_CANDIES[100], 15);
});

test('typeProgress da el porcentaje por tipo y deja fuera los tipos sin especies', () => {
  const dx = buildDexIndex(INDEX);
  const p = typeProgress([1, 3], dx);
  const fire = p.find((x) => x.type === 'fire');
  assert.deepEqual([fire?.done, fire?.total, fire?.percent], [1, 3, 33]);
  assert.equal(p.find((x) => x.type === 'grass')?.percent, 100);
  assert.equal(p.find((x) => x.type === 'water'), undefined);
});
