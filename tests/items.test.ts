// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_STATS,
  MIN_FIRE_DELAY,
  PASSIVE_ITEMS,
  computeStats,
  cooldownForPower,
  passiveById,
  rollItem,
  shapeForPower,
  toMovePower,
  type MovePower,
} from '../src/data/items.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const mp = (id: number, power = 80): MovePower => toMovePower({ id, name: `move${id}`, type: 'fire', power });

test('sin objetos, las estadísticas son las base', () => {
  assert.deepEqual(computeStats([]), BASE_STATS);
});

test('los ids de los objetos son únicos', () => {
  assert.equal(new Set(PASSIVE_ITEMS.map((i) => i.id)).size, PASSIVE_ITEMS.length);
});

test('cada objeto cambia alguna estadística', () => {
  for (const item of PASSIVE_ITEMS) {
    assert.notDeepEqual(computeStats([item.id]), BASE_STATS, item.id);
  }
});

test('los objetos se acumulan y no modifican las estadísticas base', () => {
  const snapshot = { ...BASE_STATS };
  const s = computeStats(['vidasfera', 'vidasfera', 'doble-equipo']);
  assert.ok(Math.abs(s.damage - BASE_STATS.damage * 1.3 * 1.3) < 1e-9);
  assert.equal(s.extraShots, 1);
  assert.deepEqual(BASE_STATS, snapshot);
});

test('la cadencia no baja del mínimo', () => {
  const s = computeStats(Array(30).fill('garra-rapida'));
  assert.equal(s.fireDelay, MIN_FIRE_DELAY);
});

test('un id desconocido se ignora', () => {
  assert.deepEqual(computeStats(['no-existe']), BASE_STATS);
});

test('la forma del poder depende de la potencia', () => {
  assert.equal(shapeForPower(40), 'bolt');
  assert.equal(shapeForPower(50), 'ring');
  assert.equal(shapeForPower(69), 'ring');
  assert.equal(shapeForPower(70), 'fan');
  assert.equal(shapeForPower(99), 'fan');
  assert.equal(shapeForPower(100), 'big');
  assert.equal(shapeForPower(250), 'big');
});

test('la recarga crece con la potencia y tiene tope', () => {
  assert.ok(cooldownForPower(40) < cooldownForPower(90));
  assert.equal(cooldownForPower(250), 2600);
  assert.equal(cooldownForPower(1000), 4000);
});

test('rollItem saca el poder del pool', () => {
  const pool = [mp(1), mp(2), mp(3)];
  const item = rollItem(() => 0, new Set(), pool);
  assert.equal(item.kind, 'move');
  assert.equal(pool.length, 2);
  if (item.kind === 'move') assert.ok(!pool.some((m) => m.id === item.move.id));
});

test('sin poderes en el pool, siempre sale un pasivo', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 200; i++) assert.equal(rollItem(rng, new Set(), []).kind, 'passive');
});

test('los pasivos no se repiten hasta tenerlos todos', () => {
  const owned = new Set(PASSIVE_ITEMS.map((i) => i.id));
  owned.delete('lupa');
  const rng = mulberry32(9);
  for (let i = 0; i < 100; i++) {
    const item = rollItem(rng, owned, []);
    assert.equal(item.kind === 'passive' && item.item.id, 'lupa');
  }
  // con todos ya conseguidos, vuelven a salir
  const all = new Set(PASSIVE_ITEMS.map((i) => i.id));
  assert.equal(rollItem(rng, all, []).kind, 'passive');
});

test('rollItem es determinista con la misma semilla', () => {
  const run = () => rollItem(mulberry32(3), new Set(), [mp(1), mp(2)]);
  assert.deepEqual(run(), run());
  assert.ok(passiveById('lupa'));
});
