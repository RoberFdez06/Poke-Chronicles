// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_STATS,
  MIN_FIRE_DELAY,
  PASSIVE_ITEMS,
  computeStats,
  cooldownForPower,
  moveRarity,
  moveRarityWeights,
  takeMoveByRarity,
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

test('la recarga crece con la potencia y la rareza, y tiene tope', () => {
  assert.ok(cooldownForPower(40) < cooldownForPower(60));
  assert.ok(cooldownForPower(60) < cooldownForPower(90));
  assert.ok(cooldownForPower(90) < cooldownForPower(120));
  assert.equal(cooldownForPower(40), 1380);
  assert.equal(cooldownForPower(1000), 9000);
});

test('rareza por potencia y pesos por piso', () => {
  assert.equal(moveRarity(40), 'common');
  assert.equal(moveRarity(50), 'rare');
  assert.equal(moveRarity(70), 'epic');
  assert.equal(moveRarity(100), 'legendary');
  for (let f = 1; f <= 8; f++) {
    const w = moveRarityWeights(f);
    assert.ok(w.common + w.rare + w.epic + w.legendary > 0);
  }
  assert.equal(moveRarityWeights(1).legendary, 0);
  assert.ok(moveRarityWeights(5).legendary > moveRarityWeights(2).legendary);
  assert.ok(moveRarityWeights(5).common < moveRarityWeights(1).common);
  assert.deepEqual(moveRarityWeights(99), moveRarityWeights(5));
});

test('takeMoveByRarity: en pisos altos salen más poderes raros', () => {
  const mk = () => [30, 40, 55, 60, 75, 90, 110, 120].map((p, i) => mp(i + 1, p));
  const legends = (floor: number) => {
    let n = 0;
    let seed = 12345;
    const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 400; i++) if (moveRarity(takeMoveByRarity(rng, mk(), floor).power) === 'legendary') n++;
    return n;
  };
  assert.equal(legends(1), 0);
  assert.ok(legends(5) > legends(2));
  // Si solo queda una rareza, sale de esa; y el poder se quita del pool
  const pool = [mp(1, 30)];
  assert.equal(takeMoveByRarity(() => 0.99, pool, 5).id, 1);
  assert.equal(pool.length, 0);
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

// --- T52 ---
import { PASSIVE_PRICE, PASSIVE_WEIGHT, passivePrice, passiveRarity, pickPassive } from '../src/data/items.ts';

const T52_ITEMS = [
  'mineral-evolutivo', 'cinta-experto', 'gafas-especiales', 'roca-del-rey', 'polvo-veloz', 'baya-lichi',
  'seguro-debilidad', 'bola-luminosa', 'cuerda-huida', 'hierba-mental', 'pua-toxica', 'piedra-lunar',
];

test('T52: doce pasivos nuevos, en español, que cambian algo y con rareza y precio', () => {
  for (const id of T52_ITEMS) {
    const it = PASSIVE_ITEMS.find((i) => i.id === id);
    assert.ok(it, id);
    assert.ok(it!.name && it!.description, id);
    assert.notDeepEqual(computeStats([id]), computeStats([]), id);
    assert.ok(passivePrice(id) > 0, id);
  }
  assert.equal(new Set(PASSIVE_ITEMS.map((i) => i.name)).size, PASSIVE_ITEMS.length);
  // Más raro = más caro y sale menos
  assert.ok(PASSIVE_PRICE.common < PASSIVE_PRICE.rare && PASSIVE_PRICE.rare < PASSIVE_PRICE.epic && PASSIVE_PRICE.epic < PASSIVE_PRICE.legendary);
  assert.ok(PASSIVE_WEIGHT.common > PASSIVE_WEIGHT.legendary);
  assert.equal(passiveRarity('no-existe'), 'rare');
  // La Púa Tóxica no toca las estadísticas base
  computeStats(['pua-toxica']);
  assert.equal(computeStats([]).statusBoost.poison, undefined);
});

test('T52: el sorteo de pasivos sigue los pesos de rareza', () => {
  const list = PASSIVE_ITEMS.filter((i) => ['baya-aranja', 'cola-gemela'].includes(i.id));
  assert.equal(passiveRarity('baya-aranja'), 'common');
  assert.equal(passiveRarity('cola-gemela'), 'legendary');
  const rng = mulberry32(3);
  let common = 0;
  for (let k = 0; k < 5000; k++) if (pickPassive(rng, list).id === 'baya-aranja') common++;
  assert.ok(Math.abs(common / 5000 - 0.8) < 0.03, `${common / 5000}`);
});
