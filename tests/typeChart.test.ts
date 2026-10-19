import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damageMul, effectOf, rawEffectiveness } from '../src/data/typeChart.ts';

test('súper eficaz, poco eficaz y sin efecto', () => {
  assert.equal(effectOf('water', ['fire']), 'super');
  assert.equal(effectOf('fire', ['water']), 'resisted');
  assert.equal(effectOf('normal', ['ghost']), 'immune');
  assert.equal(effectOf('normal', ['normal']), 'normal');
});

test('dos tipos se multiplican (Hierba contra Agua/Tierra ×4)', () => {
  assert.equal(rawEffectiveness('grass', ['water', 'ground']), 4);
  assert.equal(rawEffectiveness('electric', ['water', 'ground']), 0);
});

test('en el juego nunca se hace daño cero y los valores son suaves', () => {
  assert.equal(damageMul('ground', ['flying']), 0.35);
  assert.equal(damageMul('water', ['fire']), 1.5);
  assert.equal(damageMul('grass', ['water', 'ground']), 2);
  assert.equal(damageMul('fire', ['water']), 0.7);
  assert.equal(damageMul('fire', ['water', 'rock']), 0.5);
  assert.equal(damageMul(undefined, ['fire']), 1);
});

test('la tabla es coherente: solo tipos conocidos', async () => {
  const { TYPE_NAMES_ES } = await import('../src/data/types.ts');
  for (const a of Object.keys(TYPE_NAMES_ES)) for (const d of Object.keys(TYPE_NAMES_ES)) {
    const m = rawEffectiveness(a, [d]);
    assert.ok([0, 0.5, 1, 2].includes(m), `${a}→${d}=${m}`);
  }
});
