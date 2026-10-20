import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comboAlive, comboBreak, comboHit, comboTier, comboWindow, milestoneReward, newCombo } from '../src/data/combo.ts';

test('cada baja seguida suma y avisa en los hitos', () => {
  const s = newCombo();
  const hits: (number | null)[] = [];
  for (let i = 0; i < 10; i++) hits.push(comboHit(s, i * 500));
  assert.equal(s.count, 10);
  assert.deepEqual(hits.filter((h) => h !== null), [5, 10]);
});

test('si pasa el tiempo sin vencer a nadie, el combo empieza de nuevo', () => {
  const s = newCombo();
  comboHit(s, 0);
  comboHit(s, 1000);
  assert.ok(comboAlive(s, 1000 + comboWindow(2) - 1));
  assert.ok(!comboAlive(s, 1000 + comboWindow(2)));
  comboHit(s, 10_000);
  assert.equal(s.count, 1);
  assert.equal(s.best, 2);
});

test('la ventana se acorta con el combo pero nunca baja de 1,6 s', () => {
  assert.equal(comboWindow(0), 3000);
  assert.ok(comboWindow(20) < comboWindow(5));
  assert.equal(comboWindow(1000), 1600);
});

test('romper el combo devuelve cuánto era y lo deja a cero', () => {
  const s = newCombo();
  for (let i = 0; i < 4; i++) comboHit(s, i * 100);
  assert.equal(comboBreak(s), 4);
  assert.equal(s.count, 0);
  assert.equal(s.best, 4);
});

test('tramos y premios', () => {
  assert.equal(comboTier(2), null);
  assert.equal(comboTier(3)?.label, '¡Combo!');
  assert.equal(comboTier(30)?.label, '¡Imparable!');
  assert.equal(comboTier(500)?.label, '¡Maestro Pokémon!');
  assert.ok(milestoneReward(100).heal <= 25);
  assert.ok(milestoneReward(100).coins >= milestoneReward(5).coins);
});
