import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_MEDALS_BONUS, awardMedal, MEDALS, MEDAL_TICKETS, parseMedals } from '../src/data/medals.ts';
import { BIOMES } from '../src/level/biomes.ts';

test('hay una medalla por bioma', () => {
  assert.deepEqual(MEDALS.map((m) => m.id).sort(), BIOMES.map((b) => b.id).sort());
});

test('la medalla nueva da tickets y la repetida no', () => {
  const a = awardMedal([], 'bosque');
  assert.equal(a.gained?.id, 'bosque');
  assert.equal(a.tickets, MEDAL_TICKETS);
  const b = awardMedal(a.medals, 'bosque');
  assert.equal(b.gained, undefined);
  assert.equal(b.tickets, 0);
});

test('la última medalla da el bonus', () => {
  const have = MEDALS.slice(1).map((m) => m.id);
  const a = awardMedal(have, MEDALS[0].id);
  assert.equal(a.complete, true);
  assert.equal(a.tickets, MEDAL_TICKETS + ALL_MEDALS_BONUS);
});

test('parseMedals tolera basura', () => {
  assert.deepEqual(parseMedals('xx'), []);
  assert.deepEqual(parseMedals('["bosque","bosque","nada",3]'), ['bosque']);
  assert.deepEqual(parseMedals(null), []);
});
