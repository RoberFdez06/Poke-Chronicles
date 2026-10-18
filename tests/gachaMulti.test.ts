// Ejecutar con `npm test`. Tirada x10, legendario destacado e historial (supervisor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuredLegendary, pullMany, RARITIES, type RarityPools } from '../src/data/gacha.ts';
import { HISTORY_MAX, loadHistory, parseHistory, pushHistory } from '../src/data/gachaHistory.ts';
import type { StorageLike } from '../src/data/save.ts';

const pools: RarityPools = { common: [10, 11, 12], rare: [20, 21], epic: [30], ultra: [40], legendary: [50, 51] };
const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

test('x10 da 10 resultados y garantiza un épico o mejor', () => {
  // rng siempre bajo: todo saldría común
  for (let s = 0; s < 20; s++) {
    const res = pullMany(seq([0.01, 0.3, 0.02 + s / 100]), pools);
    assert.equal(res.length, 10);
    assert.ok(res.some((r) => RARITIES.indexOf(r.rarity) >= RARITIES.indexOf('epic')));
  }
});

test('x10 marca repetidos dentro de la misma tanda', () => {
  const res = pullMany(() => 0.001, pools, new Set(), 3, 'common');
  assert.equal(res[0].duplicate, false);
  assert.equal(res[1].duplicate, true);
});

test('el legendario destacado es estable en el día y sale de su lista', () => {
  const a = featuredLegendary(pools, 20000);
  assert.equal(a, featuredLegendary(pools, 20000));
  assert.ok(pools.legendary.includes(a!));
  assert.equal(featuredLegendary({ ...pools, legendary: [] }, 1), null);
});

test('historial: el más nuevo primero, como mucho HISTORY_MAX y tolera basura', () => {
  const data = new Map<string, string>();
  const st: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  pushHistory([{ id: 1, rarity: 'common', shiny: false, at: 1 }], st);
  pushHistory([2, 3].map((id) => ({ id, rarity: 'rare' as const, shiny: false, at: id })), st);
  assert.deepEqual(loadHistory(st).map((e) => e.id), [3, 2, 1]);
  pushHistory(Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, rarity: 'epic' as const, shiny: true, at: i })), st);
  assert.equal(loadHistory(st).length, HISTORY_MAX);
  assert.deepEqual(parseHistory('{'), []);
  assert.deepEqual(parseHistory('[{"id":"x"}]'), []);
});
