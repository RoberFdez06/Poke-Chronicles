// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEHAVIORS,
  BEHAVIOR_BY_TYPE,
  FALLBACK_ENEMIES,
  MIN_ENEMY_POOL,
  behaviorFor,
  behaviorForSpecies,
  ALT_BEHAVIOR_BY_TYPE,
  enemyBstRange,
  enemyPool,
  enemyStats,
  pickFloorEnemies,
} from '../src/data/enemies.ts';
import type { SpeciesFact } from '../src/data/gacha.ts';
import { difficultyFor } from '../src/level/progression.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const sp = (id: number, bst: number, extra: Partial<SpeciesFact> = {}): SpeciesFact => ({
  id,
  name: `sp${id}`,
  bst,
  legendary: false,
  mythical: false,
  ...extra,
});

// Lista de prueba: muchas especies de cada franja, más legendarios y ultraentes con poca suma
const index: SpeciesFact[] = [];
for (let i = 0; i < 300; i++) index.push(sp(1000 + i, 180 + i * 2));
index.push(sp(150, 250, { legendary: true }), sp(151, 250, { mythical: true }), sp(793, 250));

test('la franja de estadísticas sube con el piso y tiene tope', () => {
  const [lo1, hi1] = enemyBstRange(1);
  const [lo3, hi3] = enemyBstRange(3);
  assert.ok(lo1 < 300 && hi1 <= 350);
  assert.ok(lo3 > lo1 && hi3 > hi1);
  assert.deepEqual(enemyBstRange(100), enemyBstRange(50));
});

test('los enemigos del piso están en su franja', () => {
  for (const floor of [1, 2, 3, 4, 5]) {
    const [lo, hi] = enemyBstRange(floor);
    const pool = enemyPool(index, floor);
    assert.ok(pool.length >= MIN_ENEMY_POOL);
    for (const id of pool) {
      const s = index.find((x) => x.id === id)!;
      assert.ok(s.bst >= lo && s.bst <= hi, `piso ${floor}: ${s.bst} fuera de [${lo}, ${hi}]`);
    }
  }
});

test('nunca salen legendarios, singulares ni ultraentes como enemigos normales', () => {
  for (const floor of [1, 2, 3, 10]) {
    const pool = enemyPool(index, floor);
    for (const bad of [150, 151, 793]) assert.ok(!pool.includes(bad));
  }
});

test('si la franja se queda corta, coge los más cercanos', () => {
  const few = [sp(1, 250), sp(2, 600), sp(3, 700)];
  assert.deepEqual(enemyPool(few, 1), [1, 2, 3]);
  assert.deepEqual(enemyPool([], 1), [...FALLBACK_ENEMIES]);
});

test('elige especies distintas y es determinista', () => {
  const pool = enemyPool(index, 2);
  const a = pickFloorEnemies(pool, mulberry32(7));
  const b = pickFloorEnemies(pool, mulberry32(7));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
  assert.equal(a.length, 4);
  assert.deepEqual(pickFloorEnemies([5, 5], mulberry32(1)), [5]);
  assert.ok(pickFloorEnemies([], mulberry32(1)).every((id) => FALLBACK_ENEMIES.includes(id)));
});

test('cada tipo tiene un comportamiento y hay al menos cuatro distintos', () => {
  assert.equal(Object.keys(BEHAVIOR_BY_TYPE).length, 18);
  // Entre los de cada tipo y los alternativos (supervisor) salen todos
  assert.deepEqual(new Set([...Object.values(BEHAVIOR_BY_TYPE), ...Object.values(ALT_BEHAVIOR_BY_TYPE)]), new Set(BEHAVIORS));
  assert.equal(behaviorForSpecies(['rock'], 74), 'burrow');
  assert.equal(behaviorForSpecies(['rock'], 75), 'charge');
  assert.ok(BEHAVIORS.length >= 4);
  assert.equal(behaviorFor(['fire', 'flying']), 'shoot');
  assert.equal(behaviorFor(['rock']), 'charge');
  assert.equal(behaviorFor(['ghost']), 'hop');
  assert.equal(behaviorFor([]), 'chase');
  assert.equal(behaviorFor(['desconocido']), 'chase');
});

test('los enemigos más fuertes y los de pisos altos tienen más vida y daño', () => {
  const d1 = difficultyFor(1);
  const rattata = enemyStats(253, 'chase', d1);
  // T32: un Rattata del piso 1 tiene unos 70 PS (antes 60)
  assert.ok(Math.abs(rattata.hp - 70) <= 5);
  assert.ok(Math.abs(rattata.damage - 10) <= 1);
  const strong = enemyStats(500, 'chase', d1);
  assert.ok(strong.hp > rattata.hp && strong.damage > rattata.damage);
  const later = enemyStats(253, 'chase', difficultyFor(4));
  assert.ok(later.hp > rattata.hp && later.damage > rattata.damage);
  assert.ok(enemyStats(253, 'charge', d1).hp > enemyStats(253, 'shoot', d1).hp);
});
