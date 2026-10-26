// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIOMES, NORMAL_ORDER, biomeBossPool, pickBossWeighted, biomeEnemyPool, biomeFor, MIN_BIOME_POOL, pickMixedFoes } from '../src/level/biomes.ts';
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

test('el jefe sale de todos los legendarios y singulares, sea cual sea el bioma', () => {
  for (const b of BIOMES) {
    const pool = biomeBossPool(index, b);
    assert.equal(pool.length, 94);
    for (const id of pool) assert.ok(byId.get(id)!.legendary || byId.get(id)!.mythical);
    // Lunala, Solgaleo, Kyurem, Necrozma, Zacian, Eternatus, Koraidon y Miraidon pueden salir en cualquier bioma
    for (const id of [792, 791, 646, 800, 888, 890, 1007, 1008]) assert.ok(pool.includes(id), `${b.id}: ${id}`);
  }
  // Sin tipos en la lista (índice antiguo): los de siempre
  const old = index.map(({ types: _t, ...s }) => s);
  assert.ok(biomeEnemyPool(old, 1, BIOMES[0]).length > 0);
  assert.ok(biomeBossPool(old, BIOMES[0]).length > 0);
});

test('pickBossWeighted: el tipo del bioma pesa más, salen de todos los tipos y no se repite', async () => {
  const { mulberry32 } = await import('../src/level/floorGen.ts');
  const fire = BIOMES.find((b) => b.id === 'volcan')!;
  const pool = biomeBossPool(index, fire);
  const isFire = (id: number) => byId.get(id)!.types!.some((t) => fire.types.includes(t));
  const rng = mulberry32(7);
  const seen = new Set<number>();
  let fireN = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const id = pickBossWeighted(pool, rng, [], fire, index);
    seen.add(id);
    if (isFire(id)) fireN++;
  }
  const share = pool.filter(isFire).length;
  const expected = (share * 3) / (share * 3 + (pool.length - share));
  assert.ok(Math.abs(fireN / N - expected) < 0.04, `${fireN / N} vs ${expected}`);
  assert.ok(fireN / N > share / pool.length, 'más probable que sin peso');
  assert.ok([...seen].some((id) => !isFire(id)), 'salen de otros tipos');
  assert.ok(seen.size > 60, 'sale casi todo el grupo');
  // No repite mientras queden otros
  const hist: number[] = [];
  for (let i = 0; i < pool.length; i++) hist.push(pickBossWeighted(pool, rng, hist, fire, index));
  assert.equal(new Set(hist).size, pool.length);
  // Vacío: el de reserva; extremos del azar válidos
  assert.ok(pickBossWeighted([], () => 0.999999, [], fire, index) > 0);
  assert.equal(pickBossWeighted([150, 151], () => 0, [], fire, index), 150);
});

test('sin conexión: el filtro de los guardados se mantiene (se aplica al grupo antes de pesar)', () => {
  const bundled = new Set([150, 151, 1007]);
  const pool = biomeBossPool(index, BIOMES[0]).filter((id) => bundled.has(id));
  for (let i = 0; i < 50; i++) assert.ok(bundled.has(pickBossWeighted(pool, Math.random, [], BIOMES[0], index)));
});

test('los enemigos del piso mezclan tipos: uno del bioma y el resto de cualquiera', async () => {
  const { mulberry32 } = await import('../src/level/floorGen.ts');
  const forest = BIOMES.find((b) => b.id === 'bosque')!;
  let outside = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const ids = pickMixedFoes(index, 1, forest, mulberry32(seed));
    assert.ok(ids.length >= 3, `semilla ${seed}`);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(byId.get(ids[0])!.types!.some((t) => forest.types.includes(t)), 'la primera es del bioma');
    outside += ids.filter((id) => !byId.get(id)!.types!.some((t) => forest.types.includes(t))).length;
  }
  assert.ok(outside > 30, 'salen muchos de otros tipos');
});
