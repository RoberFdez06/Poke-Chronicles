// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIOME_WEATHERS,
  WEATHERS,
  WEATHER_CHANCE,
  WEATHER_DESC,
  WEATHER_LABEL,
  weatherChip,
  weatherFor,
  weatherHurts,
  weatherPowerMul,
} from '../src/data/weather.ts';
import { BIOMES } from '../src/level/biomes.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('cada clima tiene nombre y descripción en español y cada bioma sus climas', () => {
  for (const w of WEATHERS) {
    assert.ok(WEATHER_LABEL[w]);
    assert.ok(WEATHER_DESC[w]);
  }
  for (const b of BIOMES) assert.ok((BIOME_WEATHERS[b.id] ?? []).length > 0, b.id);
  assert.ok(BIOME_WEATHERS.nieve.includes('hail'));
  assert.ok(!BIOME_WEATHERS.volcan.includes('rain'));
});

test('el clima sale a veces, nunca en el piso 1, y siempre de los del bioma', () => {
  const rng = mulberry32(5);
  let some = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const w = weatherFor('bosque', 3, rng);
    if (w) {
      some++;
      assert.ok(BIOME_WEATHERS.bosque.includes(w));
    }
  }
  assert.ok(Math.abs(some / n - WEATHER_CHANCE) < 0.05, `${some / n}`);
  for (let i = 0; i < 50; i++) assert.equal(weatherFor('bosque', 1, rng), null);
  assert.equal(weatherFor('desconocido', 4, () => 0), null);
  // Misma semilla, mismo clima
  assert.equal(weatherFor('nieve', 2, mulberry32(77)), weatherFor('nieve', 2, mulberry32(77)));
});

test('lluvia y sol cambian Agua y Fuego', () => {
  assert.equal(weatherPowerMul('rain', 'water'), 1.3);
  assert.equal(weatherPowerMul('rain', 'fire'), 0.7);
  assert.equal(weatherPowerMul('sun', 'fire'), 1.3);
  assert.equal(weatherPowerMul('sun', 'water'), 0.7);
  assert.equal(weatherPowerMul('rain', 'grass'), 1);
  assert.equal(weatherPowerMul('sand', 'water'), 1);
  assert.equal(weatherPowerMul(null, 'fire'), 1);
  assert.equal(weatherPowerMul('sun', undefined), 1);
});

test('arena y granizo dañan salvo a sus tipos', () => {
  assert.ok(weatherHurts('sand', ['fire']));
  assert.ok(!weatherHurts('sand', ['rock']));
  assert.ok(!weatherHurts('sand', ['flying', 'steel']));
  assert.ok(weatherHurts('hail', ['dragon']));
  assert.ok(!weatherHurts('hail', ['ice', 'water']));
  assert.ok(!weatherHurts('rain', ['fire']));
  assert.ok(!weatherHurts(null, ['fire']));
  assert.equal(weatherChip(100), 3);
  assert.equal(weatherChip(10), 1);
});
