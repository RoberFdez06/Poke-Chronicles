// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DARK_ENEMY_MUL, DARK_GACHA_ODDS, DARK_ODDS, DARK_PLAYER_MUL, darkCooldown, darkEnemyStats, darkName, darkOdds, darkPlayerStats,
  darkTickets, parseDarks, rollDark,
} from '../src/data/darkMon.ts';
import { addDark, DARKS_KEY, loadDarks, loadUnlocked, PROGRESS_KEYS, type StorageLike } from '../src/data/save.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('oscuros: mejores en todo, entre +25 % y +40 %', () => {
  for (const m of [DARK_ENEMY_MUL, DARK_PLAYER_MUL]) {
    for (const v of [m.hp, m.damage, m.fireRate]) assert.ok(v >= 1.25 && v <= 1.4, `${v}`);
    assert.ok(m.speed > 1 && m.speed <= 1.4);
  }
  const e = darkEnemyStats({ hp: 100, damage: 10, speed: 100, extra: 'x' });
  assert.deepEqual(e, { hp: 140, damage: 13, speed: 125, extra: 'x' });
  assert.ok(darkCooldown(1000) < 1000);
  const p = darkPlayerStats({ maxHp: 100, damage: 10, speed: 200, fireDelay: 500, range: 3 });
  assert.equal(p.maxHp, 125);
  assert.ok(p.damage > 10 && p.speed > 200 && p.fireDelay < 500);
  assert.equal(p.range, 3);
});

test('oscuros: la probabilidad sube con el piso hasta su tope y jefes/legendarios son más probables', () => {
  for (const who of ['enemy', 'miniboss', 'boss', 'legend'] as const) {
    assert.equal(darkOdds(who, 1), DARK_ODDS[who].base);
    assert.ok(darkOdds(who, 5) > darkOdds(who, 1));
    assert.equal(darkOdds(who, 999), DARK_ODDS[who].max);
    assert.equal(darkOdds(who, Number.NaN), DARK_ODDS[who].base);
  }
  assert.ok(darkOdds('enemy', 3) < darkOdds('miniboss', 3));
  assert.ok(darkOdds('enemy', 3) < darkOdds('boss', 3));
  assert.ok(darkOdds('enemy', 1) < 0.01, 'los normales son raros al principio');
  // Tirada con semilla: cerca de lo esperado
  const rng = mulberry32(7);
  let n = 0;
  for (let i = 0; i < 20000; i++) if (rollDark(rng, 0.05)) n++;
  assert.ok(n > 850 && n < 1150, `${n}`);
  assert.ok(DARK_GACHA_ODDS > 0 && DARK_GACHA_ODDS < 1 / 64);
});

test('oscuros: nombre y premio', () => {
  assert.equal(darkName('Tyranitar'), 'Tyranitar Oscuro');
  assert.equal(darkTickets(10), 15);
  assert.equal(darkTickets(-3), 0);
});

test('oscuros: lista guardada limpia, addDark desbloquea y no repite; es progreso', () => {
  assert.deepEqual(parseDarks(null), []);
  assert.deepEqual(parseDarks('nada'), []);
  assert.deepEqual(parseDarks('{"a":1}'), []);
  assert.deepEqual(parseDarks('[1, 1, 2, -3, 1.5, "4"]'), [1, 2]);
  const st = fakeStorage();
  assert.equal(addDark(248, st), true);
  assert.equal(addDark(248, st), false);
  assert.deepEqual(loadDarks(st), [248]);
  assert.ok(loadUnlocked(st).includes(248));
  assert.ok(PROGRESS_KEYS.includes(DARKS_KEY));
});
