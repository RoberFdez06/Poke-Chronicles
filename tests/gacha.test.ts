// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RARITIES,
  GACHA_RATES,
  ULTRA_BEAST_IDS,
  buildPools,
  classifyRarity,
  pull,
  rollRarity,
  type Rarity,
  type SpeciesFact,
} from '../src/data/gacha.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const sp = (id: number, bst: number, extra: Partial<SpeciesFact> = {}): SpeciesFact => ({
  id,
  name: `sp${id}`,
  bst,
  legendary: false,
  mythical: false,
  ...extra,
});

test('clasifica por estadísticas, legendarios, míticos y Ultraentes', () => {
  assert.equal(classifyRarity(sp(25, 320)), 'common'); // Pikachu
  assert.equal(classifyRarity(sp(2, 405)), 'rare'); // Ivysaur
  assert.equal(classifyRarity(sp(6, 534)), 'epic'); // Charizard
  assert.equal(classifyRarity(sp(149, 600)), 'epic'); // Dragonite
  assert.equal(classifyRarity(sp(150, 680, { legendary: true })), 'legendary'); // Mewtwo
  assert.equal(classifyRarity(sp(151, 600, { mythical: true })), 'legendary'); // Mew
  assert.equal(classifyRarity(sp(793, 570, { legendary: true })), 'ultra'); // Nihilego gana a legendario
});

test('hay 11 Ultraentes', () => {
  assert.equal(ULTRA_BEAST_IDS.size, 11);
});

test('las probabilidades suman 100', () => {
  assert.equal(RARITIES.reduce((n, r) => n + GACHA_RATES[r], 0), 100);
});

test('la misma semilla da la misma tirada', () => {
  const pools = buildPools([sp(1, 300), sp(2, 450), sp(3, 550), sp(4, 600, { legendary: true }), sp(793, 570)]);
  assert.deepEqual(pull(mulberry32(7), pools), pull(mulberry32(7), pools));
});

test('la distribución de rarezas se acerca a las probabilidades', () => {
  const rng = mulberry32(12345);
  const N = 100_000;
  const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0, ultra: 0 };
  for (let i = 0; i < N; i++) counts[rollRarity(rng)]++;
  for (const r of RARITIES) {
    const pct = (counts[r] / N) * 100;
    assert.ok(Math.abs(pct - GACHA_RATES[r]) < 0.5, `${r}: ${pct.toFixed(2)}% (esperado ${GACHA_RATES[r]}%)`);
  }
});

test('buildPools reparte cada especie en una sola rareza', () => {
  const index = [sp(1, 300), sp(2, 450), sp(3, 550), sp(4, 600, { legendary: true }), sp(793, 570), sp(5, 100)];
  const pools = buildPools(index);
  const all = RARITIES.flatMap((r) => pools[r]).sort((a, b) => a - b);
  assert.deepEqual(all, index.map((s) => s.id).sort((a, b) => a - b));
  assert.deepEqual(pools.ultra, [793]);
  assert.deepEqual(pools.legendary, [4]);
});

test('si la rareza tirada está vacía, baja a la más cercana con Pokémon', () => {
  const pools = buildPools([sp(1, 300), sp(2, 310)]); // solo comunes
  const rng = mulberry32(99);
  for (let i = 0; i < 500; i++) {
    const res = pull(rng, pools);
    assert.equal(res.rarity, 'common');
    assert.ok([1, 2].includes(res.speciesId));
  }
});

test('marca los repetidos', () => {
  const pools = buildPools([sp(1, 300)]);
  assert.equal(pull(mulberry32(1), pools, new Set([1])).duplicate, true);
  assert.equal(pull(mulberry32(1), pools, new Set()).duplicate, false);
});

test('falla con un mensaje claro si no hay Pokémon', () => {
  assert.throws(() => pull(mulberry32(1), buildPools([])), /ningún Pokémon/);
});
