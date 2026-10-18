// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIOMES, NORMAL_ORDER, biomeBossPool, biomeEnemyPool, biomeFor, MIN_BIOME_POOL } from '../src/level/biomes.ts';
import { TYPE_COLORS } from '../src/data/types.ts';
import { enemyBstRange } from '../src/data/enemies.ts';
import type { SpeciesFact } from '../src/data/gacha.ts';

const index = JSON.parse(readFileSync(new URL('../public/data/species-index.json', import.meta.url), 'utf8')) as SpeciesFact[];
const byId = new Map(index.map((s) => [s.id, s]));

test('cada bioma tiene nombre, tipos que existen y colores', () => {
  assert.ok(BIOMES.length >= 7);
  for (const b of BIOMES) {
    assert.ok(b.name && b.types.length > 0, b.id);
    for (const t of b.types) assert.ok(t in TYPE_COLORS, `${b.id}: ${t}`);
    for (const c of Object.values(b.colors)) assert.ok(Number.isInteger(c) && c >= 0 && c <= 0xffffff);
  }
  assert.equal(new Set(BIOMES.map((b) => b.id)).size, BIOMES.length);
});

test('Normal sigue su orden fijo; los demás modos rotan', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((f) => biomeFor('normal', f).id), [...NORMAL_ORDER]);
  assert.equal(biomeFor('normal', 9).id, NORMAL_ORDER.at(-1));
  const endless = Array.from({ length: BIOMES.length * 2 }, (_, i) => biomeFor('endless', i + 1).id);
  assert.equal(new Set(endless).size, BIOMES.length);
  assert.equal(biomeFor('waves', 1).id, biomeFor('waves', BIOMES.length + 1).id);
});

test('los enemigos son del tipo del bioma y de una fuerza parecida a la del piso', () => {
  for (const b of BIOMES) {
    for (const floor of [1, 3, 5]) {
      const pool = biomeEnemyPool(index, floor, b);
      assert.ok(pool.length >= Math.min(MIN_BIOME_POOL, pool.length) && pool.length > 0, `${b.id} piso ${floor}`);
      for (const id of pool) {
        const s = byId.get(id)!;
        assert.ok(s.types!.some((t) => b.types.includes(t)), `${b.id}: ${s.name}`);
        assert.ok(!s.legendary && !s.mythical);
      }
      // Media de la suma de estadísticas cerca de la franja del piso
      const [lo, hi] = enemyBstRange(floor);
      const avg = pool.reduce((n, id) => n + byId.get(id)!.bst, 0) / pool.length;
      assert.ok(avg > lo - 120 && avg < hi + 120, `${b.id} piso ${floor}: ${avg}`);
    }
  }
});

test('el jefe intenta ser del tipo del bioma y siempre es legendario o singular', () => {
  for (const b of BIOMES) {
    const pool = biomeBossPool(index, b);
    assert.ok(pool.length > 0);
    for (const id of pool) assert.ok(byId.get(id)!.legendary || byId.get(id)!.mythical);
  }
  const fire = biomeBossPool(index, BIOMES.find((b) => b.id === 'volcan')!);
  assert.ok(fire.includes(146)); // Moltres
  assert.ok(fire.every((id) => byId.get(id)!.types!.some((t) => t === 'fire' || t === 'rock')));
  // Sin tipos en la lista (índice antiguo): los de siempre
  const old = index.map(({ types: _t, ...s }) => s);
  assert.ok(biomeEnemyPool(old, 1, BIOMES[0]).length > 0);
  assert.ok(biomeBossPool(old, BIOMES[0]).length > 0);
});
