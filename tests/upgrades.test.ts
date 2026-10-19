// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_KINDS,
  UPGRADE_LABEL,
  applyUpgrades,
  levelsFor,
  noUpgrades,
  parseUpgrades,
  upgradeCost,
} from '../src/data/upgrades.ts';
import { BASE_STATS } from '../src/data/items.ts';
import { addCandies, addTickets, loadCandies, buyUpgrade, loadTickets, loadUpgrades, resetProgress, type StorageLike } from '../src/data/save.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('cada nivel cuesta más y al máximo no se puede subir', () => {
  assert.equal(upgradeCost(0), 15);
  assert.equal(upgradeCost(4), 75);
  assert.equal(upgradeCost(MAX_UPGRADE_LEVEL), null);
  for (const k of UPGRADE_KINDS) assert.ok(UPGRADE_LABEL[k]);
});

test('las mejoras suben lo suyo y sin mejoras todo queda igual', () => {
  assert.deepEqual(applyUpgrades(BASE_STATS, noUpgrades()), { ...BASE_STATS });
  const s = applyUpgrades(BASE_STATS, { ...noUpgrades(), damage: 5, hp: 2, speed: 1, rate: 3, range: 2, crit: 3, armor: 5 });
  assert.ok(s.range > BASE_STATS.range);
  assert.ok(Math.abs(s.critChance - (BASE_STATS.critChance + 0.06)) < 1e-9);
  assert.ok(s.damageTaken < BASE_STATS.damageTaken);
  assert.ok(Math.abs(s.damage - BASE_STATS.damage * 1.4) < 1e-9);
  assert.equal(s.maxHp, BASE_STATS.maxHp + 20);
  assert.ok(s.speed > BASE_STATS.speed);
  assert.ok(s.fireDelay < BASE_STATS.fireDelay);
});

test('se leen aunque estén corruptas y nunca pasan del máximo', () => {
  assert.deepEqual(parseUpgrades(null), {});
  assert.deepEqual(parseUpgrades('{'), {});
  assert.deepEqual(parseUpgrades('[1,2]'), {});
  const book = parseUpgrades('{"4": {"damage": 9, "hp": -1, "speed": 2.5, "rate": 2}, "x": {"damage": 1}}');
  assert.deepEqual(book, { 4: { ...noUpgrades(), damage: MAX_UPGRADE_LEVEL, rate: 2 } });
  assert.deepEqual(levelsFor(book, 7), noUpgrades());
});

test('comprar gasta caramelos (no tickets), es por Pokémon y se borra con el progreso', () => {
  const st = fakeStorage();
  assert.equal(buyUpgrade(4, 'damage', st), 'poor');
  addTickets(500, st); // los tickets no sirven para mejorar
  assert.equal(buyUpgrade(4, 'damage', st), 'poor');
  assert.equal(loadTickets(st), 500);
  addCandies(40, st);
  assert.equal(buyUpgrade(4, 'damage', st), 'ok');
  assert.equal(loadCandies(st), 25);
  assert.equal(loadTickets(st), 500);
  assert.equal(buyUpgrade(4, 'damage', st), 'poor'); // el segundo nivel cuesta 30 y quedan 25
  assert.equal(loadCandies(st), 25);
  assert.equal(levelsFor(loadUpgrades(st), 4).damage, 1);
  assert.equal(levelsFor(loadUpgrades(st), 7).damage, 0);
  addCandies(10000, st);
  for (let i = 0; i < 10; i++) buyUpgrade(4, 'hp', st);
  assert.equal(levelsFor(loadUpgrades(st), 4).hp, MAX_UPGRADE_LEVEL);
  assert.equal(buyUpgrade(4, 'hp', st), 'max');
  resetProgress(st);
  assert.deepEqual(loadUpgrades(st), {});
});
