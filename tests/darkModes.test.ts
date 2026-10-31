// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darkProgress, darkSpawnChance, DARK_SPAWN, type DarkMode } from '../src/data/darkMon.ts';

const chance = (mode: DarkMode, p: Parameters<typeof darkProgress>[1], who: 'enemy' | 'miniboss' | 'boss' = 'enemy') => darkSpawnChance(who, darkProgress(mode, p));

test('normal / infinito / diario: piso 1 nunca, primeras salas nunca, luego sube', () => {
  for (const m of ['normal', 'endless', 'daily'] as const) {
    assert.equal(chance(m, { floor: 1, roomsCleared: 9 }), 0);
    assert.equal(chance(m, { floor: 4, roomsCleared: 0 }), 0);
    assert.equal(chance(m, { floor: 4, roomsCleared: 2 }), 0);
    assert.ok(chance(m, { floor: 4, roomsCleared: 3 }) > 0);
    assert.ok(chance(m, { floor: 2, boss: true }, 'boss') > 0);
    assert.equal(chance(m, { floor: 1, boss: true }, 'boss'), 0);
    assert.ok(chance(m, { floor: 6, roomsCleared: 5 }) > chance(m, { floor: 3, roomsCleared: 5 }));
  }
});

test('Torre: nada en los pisos 1-3, sube suave hasta el tope en 100 pisos', () => {
  for (const f of [1, 2, 3]) assert.equal(chance('tower', { floor: f, roomsCleared: 9 }), 0);
  assert.ok(chance('tower', { floor: 4 }) > 0);
  assert.ok(chance('tower', { floor: 20 }) < chance('tower', { floor: 60 }));
  assert.equal(chance('tower', { floor: 100 }), DARK_SPAWN.enemy.max);
});

test('Oleadas: nada en las oleadas 1-3, luego sube', () => {
  for (const w of [1, 2, 3]) assert.equal(chance('waves', { wave: w }), 0);
  assert.ok(chance('waves', { wave: 4 }) > 0 && chance('waves', { wave: 10 }) > chance('waves', { wave: 5 }));
});

test('Rush de jefes: nada en los dos primeros jefes', () => {
  assert.equal(chance('bossrush', { floor: 1 }, 'boss'), 0);
  assert.equal(chance('bossrush', { floor: 2 }, 'boss'), 0);
  assert.ok(chance('bossrush', { floor: 3 }, 'boss') > 0);
  assert.equal(chance('bossrush', { floor: 50 }, 'boss'), DARK_SPAWN.boss.max);
});

test('Defensa de torres: nada en las oleadas 1-4, luego sube suave', () => {
  for (const w of [1, 2, 3, 4]) assert.equal(chance('towerdef', { wave: w }), 0);
  assert.ok(chance('towerdef', { wave: 5 }) > 0);
  assert.ok(chance('towerdef', { wave: 8 }) < chance('towerdef', { wave: 20 }));
  assert.ok(chance('towerdef', { wave: 999 }) <= DARK_SPAWN.enemy.max);
});
