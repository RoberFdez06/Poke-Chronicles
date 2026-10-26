import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainBreak, chainHit, chainOdds, chainVisible, newShinyChain, SHINY_CHAIN, SHINY_ODDS } from '../src/data/shiny.ts';

test('T84: chainOdds sube con la cadena', () => {
  assert.equal(chainOdds(0), SHINY_ODDS.enemy);
  assert.ok(chainOdds(1) > chainOdds(0));
  assert.ok(chainOdds(4) > chainOdds(3));
});

test('T84: chainOdds respeta el tope', () => {
  const cap = SHINY_ODDS.enemy * SHINY_CHAIN.maxMul;
  assert.equal(chainOdds(1000), cap);
  assert.ok(chainOdds(50) <= cap);
  assert.equal(chainOdds(-3), SHINY_ODDS.enemy);
});

test('T84: misma especie sube, otra especie o un golpe la reinician', () => {
  let c = newShinyChain();
  c = chainHit(c, 25);
  c = chainHit(c, 25);
  assert.equal(c.count, 2);
  assert.ok(chainVisible(c));
  c = chainHit(c, 4);
  assert.deepEqual(c, { speciesId: 4, count: 1 });
  assert.ok(!chainVisible(c));
  c = chainHit(c, 4);
  assert.equal(chainBreak().count, 0);
  assert.equal(chainHit(c, 0), c);
});
