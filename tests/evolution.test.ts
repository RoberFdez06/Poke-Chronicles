// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVOLVE_AT, nextEvolutionIds, pickEvolution, shouldEvolve, type ChainLink } from '../src/data/evolution.ts';
import { MODES } from '../src/data/modes.ts';

const sp = (id: number, evolves_to: ChainLink[] = []): ChainLink => ({
  species: { name: `sp${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
  evolves_to,
});

// Charmander → Charmeleon → Charizard
const charmander = sp(4, [sp(5, [sp(6)])]);
// Eevee con varias ramas
const eevee = sp(133, [sp(134), sp(135), sp(136), sp(10999)]);

test('sigue la cadena evolutiva', () => {
  assert.deepEqual(nextEvolutionIds(charmander, 4), [5]);
  assert.deepEqual(nextEvolutionIds(charmander, 5), [6]);
  assert.deepEqual(nextEvolutionIds(charmander, 6), []);
  assert.deepEqual(nextEvolutionIds(charmander, 25), []);
});

test('si la cadena se ramifica elige una (y descarta formas especiales)', () => {
  assert.deepEqual(nextEvolutionIds(eevee, 133), [134, 135, 136]);
  assert.equal(pickEvolution([134, 135, 136], () => 0), 134);
  assert.equal(pickEvolution([134, 135, 136], () => 0.99), 136);
  assert.equal(pickEvolution([], () => 0), null);
});

test('cada modo evoluciona dos veces, en orden', () => {
  for (const m of MODES) {
    assert.equal(EVOLVE_AT[m].length, 2);
    assert.ok(EVOLVE_AT[m][0] < EVOLVE_AT[m][1]);
    assert.ok(!shouldEvolve(m, 1));
  }
  assert.ok(shouldEvolve('normal', 2) && shouldEvolve('normal', 4));
  assert.ok(!shouldEvolve('normal', 3));
  assert.ok(shouldEvolve('waves', 6));
});
